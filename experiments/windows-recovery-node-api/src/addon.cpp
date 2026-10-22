#include <node_api.h>

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include "parent-lock.hpp"

#include <algorithm>
#include <atomic>
#include <cstdint>
#include <memory>
#include <mutex>
#include <string>
#include <utility>
#include <vector>

namespace {

enum class ErrorCategory {
  Authorization,
  Busy,
  Malformed,
  Ambiguous,
  Io,
  Unsupported,
};

const char* categoryName(ErrorCategory category) {
  switch (category) {
    case ErrorCategory::Authorization: return "authorization";
    case ErrorCategory::Busy: return "busy";
    case ErrorCategory::Malformed: return "malformed";
    case ErrorCategory::Ambiguous: return "ambiguous";
    case ErrorCategory::Io: return "io";
    case ErrorCategory::Unsupported: return "unsupported";
  }
  return "io";
}

struct NativeFailure {
  const char* code;
  ErrorCategory category;
  bool retryable;
  DWORD win32;
};

NativeFailure convertParentLockFailure(const ParentLockError& failure) {
  ErrorCategory category = ErrorCategory::Io;
  switch (failure.category) {
    case ParentLockErrorCategory::Authorization: category = ErrorCategory::Authorization; break;
    case ParentLockErrorCategory::Busy: category = ErrorCategory::Busy; break;
    case ParentLockErrorCategory::Malformed: category = ErrorCategory::Malformed; break;
    case ParentLockErrorCategory::Ambiguous: category = ErrorCategory::Ambiguous; break;
    case ParentLockErrorCategory::Io: category = ErrorCategory::Io; break;
    case ParentLockErrorCategory::Unsupported: category = ErrorCategory::Unsupported; break;
  }
  return NativeFailure{failure.code, category,
      failure.category == ParentLockErrorCategory::Busy, failure.win32};
}

std::atomic<uint32_t> g_liveResources{0};
char kConstructorToken;

void setNamed(napi_env env, napi_value object, const char* name, napi_value value) {
  napi_set_named_property(env, object, name, value);
}

napi_value stringValue(napi_env env, const char* value) {
  napi_value result;
  napi_create_string_utf8(env, value, NAPI_AUTO_LENGTH, &result);
  return result;
}

napi_value booleanValue(napi_env env, bool value) {
  napi_value result;
  napi_get_boolean(env, value, &result);
  return result;
}

napi_value numberValue(napi_env env, uint64_t value) {
  napi_value result;
  napi_create_double(env, static_cast<double>(value), &result);
  return result;
}

void throwFailure(napi_env env, const NativeFailure& failure) {
  napi_value error;
  napi_create_error(env, nullptr, stringValue(env, failure.code), &error);
  setNamed(env, error, "code", stringValue(env, failure.code));
  setNamed(env, error, "category", stringValue(env, categoryName(failure.category)));
  setNamed(env, error, "retryable", booleanValue(env, failure.retryable));
  if (failure.win32 != ERROR_SUCCESS) {
    napi_value code;
    napi_create_uint32(env, failure.win32, &code);
    setNamed(env, error, "win32", code);
  }
  napi_throw(env, error);
}

class OwnedEvent {
 public:
  OwnedEvent() {
    handle_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    if (handle_ == nullptr) {
      throw NativeFailure{"E_SESSION_OPEN", ErrorCategory::Io, true, GetLastError()};
    }
    g_liveResources.fetch_add(1, std::memory_order_relaxed);
  }

  ~OwnedEvent() { close(); }
  OwnedEvent(const OwnedEvent&) = delete;
  OwnedEvent& operator=(const OwnedEvent&) = delete;

  bool wait(DWORD milliseconds, DWORD& error) const {
    if (handle_ == nullptr) {
      error = ERROR_INVALID_HANDLE;
      return false;
    }
    const DWORD result = WaitForSingleObject(handle_, milliseconds);
    if (result == WAIT_TIMEOUT || result == WAIT_OBJECT_0) return true;
    error = GetLastError();
    return false;
  }

  bool close() {
    if (handle_ == nullptr) return true;
    HANDLE handle = handle_;
    handle_ = nullptr;
    const bool closed = CloseHandle(handle) != 0;
    g_liveResources.fetch_sub(1, std::memory_order_relaxed);
    return closed;
  }

 private:
  HANDLE handle_ = nullptr;
};

class Session {
 public:
  Session() = default;
  Session(const std::wstring& parentPath, bool failAfterLock) {
    parentLock_ = std::make_unique<ParentLock>(parentPath);
    if (failAfterLock) {
      throw NativeFailure{"E_SESSION_INIT_INJECTED", ErrorCategory::Io, false, ERROR_SUCCESS};
    }
  }

  void closeLocked() {
    if (closed_) return;
    closed_ = true;
    DWORD closeError = ERROR_SUCCESS;
    if (!event_.close()) {
      closeError = GetLastError();
    }
    if (parentLock_) {
      try {
        parentLock_->close();
      } catch (const ParentLockError& failure) {
        if (closeError == ERROR_SUCCESS) closeError = failure.win32;
      }
    }
    if (closeError != ERROR_SUCCESS) {
      throw NativeFailure{"E_SESSION_CLOSE", ErrorCategory::Io, false, closeError};
    }
  }

  void probe(DWORD delay, uint64_t& result) {
    std::lock_guard<std::mutex> operationGuard(operationMutex_);
    {
      std::lock_guard<std::mutex> stateGuard(stateMutex_);
      if (closed_) {
        throw NativeFailure{"E_SESSION_CLOSED", ErrorCategory::Unsupported, false, ERROR_INVALID_HANDLE};
      }
      ++active_;
      peak_ = std::max(peak_, active_);
    }
    DWORD error = ERROR_SUCCESS;
    const bool ok = event_.wait(delay, error);
    {
      std::lock_guard<std::mutex> stateGuard(stateMutex_);
      --active_;
      if (ok) result = ++sequence_;
    }
    if (!ok) throw NativeFailure{"E_SESSION_PROBE", ErrorCategory::Io, true, error};
  }

  void close() {
    std::lock_guard<std::mutex> operationGuard(operationMutex_);
    std::lock_guard<std::mutex> stateGuard(stateMutex_);
    closeLocked();
  }

  void snapshot(bool& closed, uint64_t& sequence, uint32_t& active, uint32_t& peak) {
    std::lock_guard<std::mutex> guard(stateMutex_);
    closed = closed_;
    sequence = sequence_;
    active = active_;
    peak = peak_;
  }

 private:
  // The operation mutex protects the handle from close while allowing
  // snapshot() to observe a running operation without waiting for it.
  std::mutex operationMutex_;
  std::mutex stateMutex_;
  OwnedEvent event_;
  std::unique_ptr<ParentLock> parentLock_;
  bool closed_ = false;
  uint64_t sequence_ = 0;
  uint32_t active_ = 0;
  uint32_t peak_ = 0;
};

std::wstring getWideString(napi_env env, napi_value value, const char* message) {
  static_assert(sizeof(wchar_t) == sizeof(char16_t), "Windows wchar_t must be UTF-16");
  size_t length = 0;
  if (napi_get_value_string_utf16(env, value, nullptr, 0, &length) != napi_ok || length == 0) {
    napi_throw_type_error(env, nullptr, message);
    return {};
  }
  std::vector<char16_t> buffer(length + 1);
  size_t written = 0;
  if (napi_get_value_string_utf16(env, value, buffer.data(), buffer.size(), &written) != napi_ok ||
      written != length) {
    napi_throw_type_error(env, nullptr, message);
    return {};
  }
  if (std::find(buffer.begin(), buffer.begin() + written, u'\0') != buffer.begin() + written) {
    napi_throw_type_error(env, nullptr, message);
    return {};
  }
  return std::wstring(reinterpret_cast<const wchar_t*>(buffer.data()), written);
}

bool getBooleanOption(napi_env env, napi_value options, const char* name) {
  bool present = false;
  if (napi_has_named_property(env, options, name, &present) != napi_ok) {
    napi_throw_type_error(env, nullptr, "Unable to read session options.");
    return false;
  }
  if (!present) return false;
  napi_value value;
  bool result = false;
  if (napi_get_named_property(env, options, name, &value) != napi_ok ||
      napi_get_value_bool(env, value, &result) != napi_ok) {
    napi_throw_type_error(env, nullptr, "Session fault-injection options must be booleans.");
    return false;
  }
  return result;
}

struct AddonData {
  napi_ref sessionConstructor = nullptr;
  std::atomic<uint32_t> pendingWorks{0};
  std::atomic<bool> shuttingDown{false};
  napi_async_cleanup_hook_handle cleanupHandle = nullptr;
};

constexpr uint32_t kMaximumPendingWorks = 8;

bool reservePendingWork(AddonData* addon) {
  uint32_t pending = addon->pendingWorks.load(std::memory_order_acquire);
  while (pending < kMaximumPendingWorks) {
    if (addon->pendingWorks.compare_exchange_weak(
            pending, pending + 1, std::memory_order_acq_rel,
            std::memory_order_acquire)) {
      return true;
    }
  }
  return false;
}

struct ProbeWork {
  napi_async_work work = nullptr;
  napi_deferred deferred = nullptr;
  napi_ref receiver = nullptr;
  Session* session = nullptr;
  AddonData* addon = nullptr;
  DWORD delay = 0;
  uint64_t sequence = 0;
  NativeFailure failure{"", ErrorCategory::Io, false, ERROR_SUCCESS};
  bool failed = false;
};

void maybeReleaseCleanupHook(AddonData* addon) {
  if (addon->shuttingDown.load(std::memory_order_acquire) &&
      addon->pendingWorks.load(std::memory_order_acquire) == 0 &&
      addon->cleanupHandle != nullptr) {
    napi_async_cleanup_hook_handle handle = addon->cleanupHandle;
    addon->cleanupHandle = nullptr;
    napi_remove_async_cleanup_hook(handle);
  }
}

void cleanupEnvironment(napi_async_cleanup_hook_handle handle, void* data) {
  auto* addon = static_cast<AddonData*>(data);
  addon->shuttingDown.store(true, std::memory_order_release);
  addon->cleanupHandle = handle;
  maybeReleaseCleanupHook(addon);
}

Session* unwrapSession(napi_env env, napi_callback_info info, size_t* argc = nullptr,
                      napi_value* argv = nullptr, napi_value* receiver = nullptr) {
  size_t localArgc = argc ? *argc : 0;
  napi_value self;
  if (napi_get_cb_info(env, info, &localArgc, argv, &self, nullptr) != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to read native session arguments.");
    return nullptr;
  }
  if (argc) *argc = localArgc;
  if (receiver) *receiver = self;
  Session* session = nullptr;
  if (napi_unwrap(env, self, reinterpret_cast<void**>(&session)) != napi_ok || session == nullptr) {
    napi_throw_type_error(env, nullptr, "Invalid native transaction session receiver.");
    return nullptr;
  }
  return session;
}

void finalizeSession(napi_env, void* data, void*) {
  delete static_cast<Session*>(data);
}

napi_value wrapSession(napi_env env, AddonData* addon, std::unique_ptr<Session> session) {
  napi_value constructor;
  napi_value token;
  if (napi_get_reference_value(env, addon->sessionConstructor, &constructor) != napi_ok ||
      napi_create_external(env, &kConstructorToken, nullptr, nullptr, &token) != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to construct native session wrapper.");
    return nullptr;
  }
  napi_value instance;
  if (napi_new_instance(env, constructor, 1, &token, &instance) != napi_ok) return nullptr;
  if (napi_wrap(env, instance, session.get(), finalizeSession, nullptr, nullptr) != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to attach native session state.");
    return nullptr;
  }
  session.release();
  return instance;
}

napi_value sessionConstructor(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_value self;
  if (napi_get_cb_info(env, info, &argc, argv, &self, nullptr) != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to construct native session.");
    return nullptr;
  }
  void* raw = nullptr;
  if (argc != 1 || napi_get_value_external(env, argv[0], &raw) != napi_ok ||
      raw != &kConstructorToken) {
    napi_throw_type_error(env, nullptr, "Native sessions must be created by openSession().");
    return nullptr;
  }
  return self;
}

napi_value openSession(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to read session options.");
    return nullptr;
  }
  bool failAfterResource = false;
  if (argc > 0) {
    napi_valuetype type;
    if (napi_typeof(env, argv[0], &type) != napi_ok || type != napi_object) {
      napi_throw_type_error(env, nullptr, "Session options must be an object.");
      return nullptr;
    }
    napi_value injected;
    bool present = false;
    if (napi_has_named_property(env, argv[0], "failAfterResource", &present) != napi_ok) {
      napi_throw_type_error(env, nullptr, "Unable to read session options.");
      return nullptr;
    }
    if (present) {
      napi_get_named_property(env, argv[0], "failAfterResource", &injected);
      if (napi_get_value_bool(env, injected, &failAfterResource) != napi_ok) {
        napi_throw_type_error(env, nullptr, "failAfterResource must be a boolean.");
        return nullptr;
      }
    }
  }

  std::unique_ptr<Session> session;
  try {
    session = std::make_unique<Session>();
    if (failAfterResource) {
      throw NativeFailure{"E_SESSION_INIT_INJECTED", ErrorCategory::Io, false, ERROR_SUCCESS};
    }
    AddonData* data = nullptr;
    if (napi_get_instance_data(env, reinterpret_cast<void**>(&data)) != napi_ok) {
      throw NativeFailure{"E_SESSION_INIT", ErrorCategory::Unsupported, false, ERROR_NOT_SUPPORTED};
    }
    if (data == nullptr || data->sessionConstructor == nullptr) {
      throw NativeFailure{"E_SESSION_INIT", ErrorCategory::Unsupported, false, ERROR_NOT_SUPPORTED};
    }
    napi_value constructor;
    napi_value token;
    if (napi_get_reference_value(env, data->sessionConstructor, &constructor) != napi_ok ||
        napi_create_external(env, &kConstructorToken, nullptr, nullptr, &token) != napi_ok) {
      throw NativeFailure{"E_SESSION_INIT", ErrorCategory::Io, false, ERROR_SUCCESS};
    }
    napi_value instance;
    if (napi_new_instance(env, constructor, 1, &token, &instance) != napi_ok) {
      return nullptr;
    }
    if (napi_wrap(env, instance, session.get(), finalizeSession, nullptr, nullptr) != napi_ok) {
      throw NativeFailure{"E_SESSION_WRAP", ErrorCategory::Io, false, ERROR_SUCCESS};
    }
    session.release();
    return instance;
  } catch (const NativeFailure& failure) {
    throwFailure(env, failure);
    return nullptr;
  } catch (...) {
    throwFailure(env, NativeFailure{"E_SESSION_INIT", ErrorCategory::Io, false, ERROR_SUCCESS});
    return nullptr;
  }
}

napi_value openLockedSession(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok || argc == 0) {
    napi_throw_type_error(env, nullptr, "openLockedSession requires an authorized parent path.");
    return nullptr;
  }
  napi_valuetype pathType;
  if (napi_typeof(env, argv[0], &pathType) != napi_ok || pathType != napi_string) {
    napi_throw_type_error(env, nullptr, "Authorized parent path must be a string.");
    return nullptr;
  }
  const std::wstring parentPath = getWideString(
      env, argv[0], "Authorized parent path must be a non-empty UTF-16 string without NUL.");
  bool exceptionPending = false;
  napi_is_exception_pending(env, &exceptionPending);
  if (exceptionPending) return nullptr;

  bool failAfterLock = false;
  if (argc > 1) {
    napi_valuetype optionsType;
    if (napi_typeof(env, argv[1], &optionsType) != napi_ok || optionsType != napi_object) {
      napi_throw_type_error(env, nullptr, "Locked-session options must be an object.");
      return nullptr;
    }
    failAfterLock = getBooleanOption(env, argv[1], "failAfterLock");
    napi_is_exception_pending(env, &exceptionPending);
    if (exceptionPending) return nullptr;
  }

  AddonData* addon = nullptr;
  if (napi_get_instance_data(env, reinterpret_cast<void**>(&addon)) != napi_ok || addon == nullptr) {
    napi_throw_error(env, nullptr, "Native session environment is unavailable.");
    return nullptr;
  }
  try {
    auto session = std::make_unique<Session>(parentPath, failAfterLock);
    return wrapSession(env, addon, std::move(session));
  } catch (const ParentLockError& failure) {
    throwFailure(env, convertParentLockFailure(failure));
    return nullptr;
  } catch (const NativeFailure& failure) {
    throwFailure(env, failure);
    return nullptr;
  } catch (...) {
    throwFailure(env, NativeFailure{"E_SESSION_INIT", ErrorCategory::Io, false, ERROR_SUCCESS});
    return nullptr;
  }
}

void executeProbe(napi_env, void* data) {
  auto* probe = static_cast<ProbeWork*>(data);
  try {
    probe->session->probe(probe->delay, probe->sequence);
  } catch (const NativeFailure& failure) {
    probe->failure = failure;
    probe->failed = true;
  } catch (...) {
    probe->failure = NativeFailure{"E_SESSION_PROBE", ErrorCategory::Io, false, ERROR_SUCCESS};
    probe->failed = true;
  }
}

void completeProbe(napi_env env, napi_status status, void* data) {
  std::unique_ptr<ProbeWork> probe(static_cast<ProbeWork*>(data));
  const bool shuttingDown = probe->addon->shuttingDown.load(std::memory_order_acquire);
  if (!shuttingDown) {
    if (status == napi_cancelled && !probe->failed) {
      probe->failure = NativeFailure{"E_SESSION_CANCELLED", ErrorCategory::Busy, true, ERROR_SUCCESS};
      probe->failed = true;
    } else if (status != napi_ok && !probe->failed) {
      probe->failure = NativeFailure{"E_SESSION_PROBE", ErrorCategory::Io, true, ERROR_SUCCESS};
      probe->failed = true;
    }
    if (probe->failed) {
      napi_value error;
      napi_create_error(env, nullptr, stringValue(env, probe->failure.code), &error);
      setNamed(env, error, "code", stringValue(env, probe->failure.code));
      setNamed(env, error, "category", stringValue(env, categoryName(probe->failure.category)));
      setNamed(env, error, "retryable", booleanValue(env, probe->failure.retryable));
      if (probe->failure.win32 != ERROR_SUCCESS) {
        napi_value win32;
        napi_create_uint32(env, probe->failure.win32, &win32);
        setNamed(env, error, "win32", win32);
      }
      napi_reject_deferred(env, probe->deferred, error);
    } else {
      napi_value result;
      napi_create_object(env, &result);
      setNamed(env, result, "sequence", numberValue(env, probe->sequence));
      napi_resolve_deferred(env, probe->deferred, result);
    }
  }
  napi_delete_reference(env, probe->receiver);
  napi_delete_async_work(env, probe->work);
  probe->addon->pendingWorks.fetch_sub(1, std::memory_order_acq_rel);
  maybeReleaseCleanupHook(probe->addon);
}

napi_value sessionProbe(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];
  napi_value self;
  Session* session = unwrapSession(env, info, &argc, argv, &self);
  if (session == nullptr) return nullptr;
  uint32_t delay = 0;
  if (argc > 0 && napi_get_value_uint32(env, argv[0], &delay) != napi_ok) {
    napi_throw_type_error(env, nullptr, "probe delay must be an integer number of milliseconds.");
    return nullptr;
  }
  if (delay > 1000) {
    napi_throw_range_error(env, nullptr, "probe delay must not exceed 1000 ms.");
    return nullptr;
  }

  AddonData* addon = nullptr;
  if (napi_get_instance_data(env, reinterpret_cast<void**>(&addon)) != napi_ok || addon == nullptr) {
    napi_throw_error(env, nullptr, "Native session environment is unavailable.");
    return nullptr;
  }
  if (addon->shuttingDown.load(std::memory_order_acquire)) {
    napi_throw_error(env, nullptr, "Native session environment is shutting down.");
    return nullptr;
  }

  bool failQueue = false;
  bool cancelAfterQueue = false;
  if (argc > 1) {
    napi_valuetype optionsType;
    if (napi_typeof(env, argv[1], &optionsType) != napi_ok || optionsType != napi_object) {
      napi_throw_type_error(env, nullptr, "Probe test options must be an object.");
      return nullptr;
    }
    bool present = false;
    if (napi_has_named_property(env, argv[1], "failQueue", &present) != napi_ok) {
      napi_throw_type_error(env, nullptr, "Unable to read probe test options.");
      return nullptr;
    }
    if (present) {
      napi_value injected;
      if (napi_get_named_property(env, argv[1], "failQueue", &injected) != napi_ok ||
          napi_get_value_bool(env, injected, &failQueue) != napi_ok) {
        napi_throw_type_error(env, nullptr, "failQueue must be a boolean.");
        return nullptr;
      }
    }
    present = false;
    if (napi_has_named_property(env, argv[1], "cancelAfterQueue", &present) != napi_ok) {
      napi_throw_type_error(env, nullptr, "Unable to read probe test options.");
      return nullptr;
    }
    if (present) {
      napi_value injected;
      if (napi_get_named_property(env, argv[1], "cancelAfterQueue", &injected) != napi_ok ||
          napi_get_value_bool(env, injected, &cancelAfterQueue) != napi_ok) {
        napi_throw_type_error(env, nullptr, "cancelAfterQueue must be a boolean.");
        return nullptr;
      }
    }
  }

  auto probe = std::make_unique<ProbeWork>();
  probe->session = session;
  probe->addon = addon;
  probe->delay = delay;
  napi_value promise;
  if (napi_create_promise(env, &probe->deferred, &promise) != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to create native session promise.");
    return nullptr;
  }
  napi_value resourceName = stringValue(env, "svger:session-probe");
  if (napi_create_async_work(env, nullptr, resourceName, executeProbe, completeProbe,
                             probe.get(), &probe->work) != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to create native session work.");
    return nullptr;
  }
  if (napi_create_reference(env, self, 1, &probe->receiver) != napi_ok) {
    napi_delete_async_work(env, probe->work);
    napi_throw_error(env, nullptr, "Unable to retain native session receiver.");
    return nullptr;
  }
  if (!reservePendingWork(addon)) {
    napi_delete_reference(env, probe->receiver);
    napi_delete_async_work(env, probe->work);
    throwFailure(env, NativeFailure{"E_SESSION_BUSY", ErrorCategory::Busy, true, ERROR_SUCCESS});
    return nullptr;
  }
  const napi_status queueStatus = failQueue
      ? napi_generic_failure
      : napi_queue_async_work(env, probe->work);
  if (queueStatus != napi_ok) {
    napi_delete_reference(env, probe->receiver);
    napi_delete_async_work(env, probe->work);
    addon->pendingWorks.fetch_sub(1, std::memory_order_acq_rel);
    const char* code = failQueue ? "E_SESSION_QUEUE_INJECTED" : "E_SESSION_QUEUE";
    throwFailure(env, NativeFailure{code, ErrorCategory::Io, true, ERROR_SUCCESS});
    return nullptr;
  }
  if (cancelAfterQueue) {
    // Test-only: CI saturates libuv's worker pool first so this queued item is
    // deterministically cancellable before executeProbe begins.
    napi_cancel_async_work(env, probe->work);
  }
  probe.release();
  return promise;
}

napi_value sessionClose(napi_env env, napi_callback_info info) {
  Session* session = unwrapSession(env, info);
  if (session == nullptr) return nullptr;
  try {
    session->close();
    napi_value undefined;
    napi_get_undefined(env, &undefined);
    return undefined;
  } catch (const NativeFailure& failure) {
    throwFailure(env, failure);
    return nullptr;
  } catch (...) {
    throwFailure(env, NativeFailure{"E_SESSION_CLOSE", ErrorCategory::Io, false, ERROR_SUCCESS});
    return nullptr;
  }
}

napi_value sessionSnapshot(napi_env env, napi_callback_info info) {
  Session* session = unwrapSession(env, info);
  if (session == nullptr) return nullptr;
  bool closed = false;
  uint64_t sequence = 0;
  uint32_t active = 0;
  uint32_t peak = 0;
  session->snapshot(closed, sequence, active, peak);
  napi_value result;
  napi_create_object(env, &result);
  setNamed(env, result, "closed", booleanValue(env, closed));
  setNamed(env, result, "sequence", numberValue(env, sequence));
  setNamed(env, result, "activeOperations", numberValue(env, active));
  setNamed(env, result, "peakConcurrentOperations", numberValue(env, peak));
  return result;
}

napi_value liveResourceCount(napi_env env, napi_callback_info) {
  napi_value result;
  napi_create_uint32(env, g_liveResources.load(std::memory_order_relaxed), &result);
  return result;
}

napi_value pendingWorkCount(napi_env env, napi_callback_info) {
  AddonData* addon = nullptr;
  if (napi_get_instance_data(env, reinterpret_cast<void**>(&addon)) != napi_ok || addon == nullptr) {
    napi_throw_error(env, nullptr, "Native session environment is unavailable.");
    return nullptr;
  }
  napi_value result;
  napi_create_uint32(env, addon->pendingWorks.load(std::memory_order_acquire), &result);
  return result;
}

napi_value authorizationHandleCount(napi_env env, napi_callback_info) {
  napi_value result;
  napi_create_uint32(env, liveAuthorizationHandleCount(), &result);
  return result;
}

void finalizeAddon(napi_env, void* data, void*) {
  // Node disposes environment-owned napi_ref values during teardown. Keep this
  // callback native-only because it runs after cleanup hooks on shutdown.
  delete static_cast<AddonData*>(data);
}

napi_value initialize(napi_env env, napi_value exports) {
  auto addon = std::make_unique<AddonData>();
  napi_property_descriptor sessionProperties[] = {
      {"probe", nullptr, sessionProbe, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"close", nullptr, sessionClose, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"snapshot", nullptr, sessionSnapshot, nullptr, nullptr, nullptr, napi_default, nullptr},
  };
  napi_value constructor;
  if (napi_define_class(env, "NativeSession", NAPI_AUTO_LENGTH, sessionConstructor,
                        nullptr, 3, sessionProperties, &constructor) != napi_ok) {
    return nullptr;
  }
  if (napi_create_reference(env, constructor, 1, &addon->sessionConstructor) != napi_ok) {
    return nullptr;
  }
  if (napi_add_async_cleanup_hook(env, cleanupEnvironment, addon.get(),
                                  &addon->cleanupHandle) != napi_ok) {
    napi_delete_reference(env, addon->sessionConstructor);
    return nullptr;
  }
  if (napi_set_instance_data(env, addon.get(), finalizeAddon, nullptr) != napi_ok) {
    napi_remove_async_cleanup_hook(addon->cleanupHandle);
    napi_delete_reference(env, addon->sessionConstructor);
    napi_throw_error(env, nullptr, "Unable to initialize native session module.");
    return nullptr;
  }
  addon.release();
  napi_property_descriptor moduleProperties[] = {
      {"openSession", nullptr, openSession, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"openLockedSession", nullptr, openLockedSession, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"liveResourceCount", nullptr, liveResourceCount, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"pendingWorkCount", nullptr, pendingWorkCount, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"authorizationHandleCount", nullptr, authorizationHandleCount, nullptr, nullptr, nullptr, napi_default, nullptr},
  };
  if (napi_define_properties(env, exports, sizeof(moduleProperties) / sizeof(moduleProperties[0]), moduleProperties) != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to export native session module.");
    return nullptr;
  }
  return exports;
}

}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, initialize)
