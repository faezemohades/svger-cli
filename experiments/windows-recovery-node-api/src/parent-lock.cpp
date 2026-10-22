#include "parent-lock.hpp"

#include <aclapi.h>
#include <sddl.h>

#include <atomic>
#include <cwchar>
#include <cstring>
#include <iterator>
#include <utility>
#include <vector>

namespace {

std::atomic<uint32_t> g_authorizationHandles{0};

class Handle final {
 public:
  Handle() = default;
  explicit Handle(HANDLE value) : value_(value) {}
  ~Handle() { reset(); }
  Handle(const Handle&) = delete;
  Handle& operator=(const Handle&) = delete;
  Handle(Handle&& other) noexcept : value_(other.release()) {}
  Handle& operator=(Handle&& other) noexcept {
    if (this != &other) reset(other.release());
    return *this;
  }
  HANDLE get() const { return value_; }
  HANDLE release() {
    HANDLE result = value_;
    value_ = INVALID_HANDLE_VALUE;
    return result;
  }
  void reset(HANDLE value = INVALID_HANDLE_VALUE) {
    if (value_ != INVALID_HANDLE_VALUE && value_ != nullptr) CloseHandle(value_);
    value_ = value;
  }
  explicit operator bool() const { return value_ != INVALID_HANDLE_VALUE && value_ != nullptr; }

 private:
  HANDLE value_ = INVALID_HANDLE_VALUE;
};

struct LocalMemory {
  HLOCAL value = nullptr;
  ~LocalMemory() { if (value) LocalFree(value); }
  LocalMemory(const LocalMemory&) = delete;
  LocalMemory& operator=(const LocalMemory&) = delete;
  LocalMemory() = default;
};

struct TokenUserBuffer {
  std::vector<unsigned char> bytes;
  TOKEN_USER* get() { return reinterpret_cast<TOKEN_USER*>(bytes.data()); }
};

[[noreturn]] void fail(const char* code, DWORD error = GetLastError(),
                       ParentLockErrorCategory category = ParentLockErrorCategory::Io) {
  throw ParentLockError{code, error, category};
}

PSID tokenUserSid(TokenUserBuffer& storage, Handle& token) {
  HANDLE raw = INVALID_HANDLE_VALUE;
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &raw)) fail("E_PARENT_TOKEN", GetLastError());
  token = Handle(raw);
  DWORD needed = 0;
  GetTokenInformation(token.get(), TokenUser, nullptr, 0, &needed);
  if (GetLastError() != ERROR_INSUFFICIENT_BUFFER || needed == 0)
    fail("E_PARENT_TOKEN", ERROR_INVALID_DATA);
  storage.bytes.resize(needed);
  if (!GetTokenInformation(token.get(), TokenUser, storage.get(), needed, &needed))
    fail("E_PARENT_TOKEN", GetLastError());
  return storage.get()->User.Sid;
}

bool sameSid(PSID left, PSID right) {
  return left != nullptr && right != nullptr && EqualSid(left, right) != FALSE;
}

PSID parseSid(const wchar_t* value, LocalMemory& storage) {
  PSID result = nullptr;
  if (!ConvertStringSidToSidW(value, &result)) fail("E_PARENT_DESCRIPTOR", GetLastError());
  storage.value = result;
  return result;
}

bool writeCapable(DWORD mask) {
  GENERIC_MAPPING mapping{FILE_GENERIC_READ, FILE_GENERIC_WRITE,
                         FILE_GENERIC_EXECUTE, FILE_ALL_ACCESS};
  MapGenericMask(&mask, &mapping);
  constexpr DWORD forbidden = FILE_WRITE_DATA | FILE_APPEND_DATA | FILE_WRITE_EA |
      FILE_WRITE_ATTRIBUTES | FILE_DELETE_CHILD | DELETE | WRITE_DAC | WRITE_OWNER;
  return (mask & forbidden) != 0;
}

void inspectObject(HANDLE object, bool directory, bool requireProtected,
                   DWORD requiredAccess) {
  BY_HANDLE_FILE_INFORMATION info{};
  if (!GetFileInformationByHandle(object, &info)) fail("E_PARENT_IDENTITY", GetLastError());
  if ((info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0)
    fail("E_PARENT_REPARSE", ERROR_CANT_ACCESS_FILE, ParentLockErrorCategory::Authorization);
  if (directory != ((info.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0))
    fail("E_PARENT_TYPE", ERROR_DIRECTORY, ParentLockErrorCategory::Authorization);
  if (!directory && info.nNumberOfLinks != 1)
    fail("E_LOCK_LINK_COUNT", ERROR_ACCESS_DENIED, ParentLockErrorCategory::Ambiguous);

  PSID owner = nullptr;
  PSID group = nullptr;
  PACL dacl = nullptr;
  PSECURITY_DESCRIPTOR descriptor = nullptr;
  const DWORD securityStatus = GetSecurityInfo(
      object, SE_FILE_OBJECT,
      OWNER_SECURITY_INFORMATION | GROUP_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
      &owner, &group, &dacl, nullptr, &descriptor);
  LocalMemory descriptorStorage;
  descriptorStorage.value = descriptor;
  if (securityStatus != ERROR_SUCCESS) fail("E_PARENT_DESCRIPTOR", securityStatus);
  if (owner == nullptr || group == nullptr || dacl == nullptr)
    fail("E_PARENT_DESCRIPTOR", ERROR_INVALID_SECURITY_DESCR);

  SECURITY_DESCRIPTOR_CONTROL control = 0;
  DWORD revision = 0;
  if (!GetSecurityDescriptorControl(descriptor, &control, &revision))
    fail("E_PARENT_DESCRIPTOR", GetLastError());
  if (requireProtected && (control & SE_DACL_PROTECTED) == 0)
    fail("E_PARENT_DACL_INHERITED", ERROR_ACCESS_DENIED, ParentLockErrorCategory::Authorization);

  Handle token;
  TokenUserBuffer userBuffer;
  PSID currentUser = tokenUserSid(userBuffer, token);
  if (!sameSid(owner, currentUser))
    fail("E_PARENT_OWNER", ERROR_ACCESS_DENIED, ParentLockErrorCategory::Authorization);
  LocalMemory systemStorage;
  PSID system = parseSid(L"S-1-5-18", systemStorage);

  ACL_SIZE_INFORMATION aclInfo{};
  if (!GetAclInformation(dacl, &aclInfo, static_cast<DWORD>(sizeof(aclInfo)), AclSizeInformation))
    fail("E_PARENT_DACL", GetLastError());
  for (DWORD index = 0; index < aclInfo.AceCount; ++index) {
    void* rawAce = nullptr;
    if (!GetAce(dacl, index, &rawAce)) fail("E_PARENT_ACE", GetLastError());
    const auto* header = static_cast<const ACE_HEADER*>(rawAce);
    PSID trustee = nullptr;
    DWORD mask = 0;
    if (header->AceType == ACCESS_ALLOWED_ACE_TYPE) {
      const auto* ace = static_cast<const ACCESS_ALLOWED_ACE*>(rawAce);
      trustee = const_cast<DWORD*>(&ace->SidStart);
      mask = ace->Mask;
    } else if (header->AceType == ACCESS_DENIED_ACE_TYPE) {
      // Denies do not grant authority; AccessCheck below still verifies the
      // current token's required access. Reject malformed entries separately.
      const auto* ace = static_cast<const ACCESS_DENIED_ACE*>(rawAce);
      trustee = const_cast<DWORD*>(&ace->SidStart);
    } else {
      // Object, callback, mandatory-label and unknown ACE layouts are outside
      // this prototype's audited parser and fail closed.
      fail("E_PARENT_ACE_UNSUPPORTED", ERROR_NOT_SUPPORTED, ParentLockErrorCategory::Unsupported);
    }
    if (trustee == nullptr || !IsValidSid(trustee)) fail("E_PARENT_ACE", ERROR_INVALID_ACL);
    if (header->AceType == ACCESS_ALLOWED_ACE_TYPE && writeCapable(mask) &&
        !sameSid(trustee, currentUser) && !sameSid(trustee, system))
      fail("E_PARENT_UNTRUSTED_WRITE_ACE", ERROR_ACCESS_DENIED, ParentLockErrorCategory::Authorization);
  }

  HANDLE rawImpersonation = INVALID_HANDLE_VALUE;
  if (!DuplicateToken(token.get(), SecurityImpersonation, &rawImpersonation))
    fail("E_PARENT_TOKEN", GetLastError());
  Handle impersonation(rawImpersonation);
  GENERIC_MAPPING mapping{FILE_GENERIC_READ, FILE_GENERIC_WRITE,
                          FILE_GENERIC_EXECUTE, FILE_ALL_ACCESS};
  MapGenericMask(&requiredAccess, &mapping);
  DWORD privilegeBytes = static_cast<DWORD>(sizeof(PRIVILEGE_SET));
  DWORD granted = 0;
  BOOL allowed = FALSE;
  PRIVILEGE_SET privileges{};
  BOOL result = AccessCheck(descriptor, impersonation.get(), requiredAccess,
                            &mapping, &privileges, &privilegeBytes,
                            &granted, &allowed);
  std::vector<unsigned char> expanded;
  if (!result && GetLastError() == ERROR_INSUFFICIENT_BUFFER) {
    expanded.resize(privilegeBytes);
    auto* storage = reinterpret_cast<PRIVILEGE_SET*>(expanded.data());
    result = AccessCheck(descriptor, impersonation.get(), requiredAccess,
                         &mapping, storage, &privilegeBytes, &granted, &allowed);
  }
  if (!result) fail("E_PARENT_ACCESS_CHECK", GetLastError());
  if (!allowed) fail("E_PARENT_ACCESS", ERROR_ACCESS_DENIED);
}

HANDLE openDirectory(const std::wstring& path, DWORD access) {
  HANDLE handle = CreateFileW(path.c_str(), access,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr,
      OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  if (handle == INVALID_HANDLE_VALUE) fail("E_PARENT_OPEN", GetLastError());
  return handle;
}

std::wstring finalPath(HANDLE directory) {
  std::vector<wchar_t> buffer(32768);
  DWORD length = GetFinalPathNameByHandleW(directory, buffer.data(),
      static_cast<DWORD>(buffer.size()), FILE_NAME_NORMALIZED | VOLUME_NAME_DOS);
  if (length == 0 || length >= buffer.size()) fail("E_PARENT_PHYSICAL_PATH", GetLastError());
  return std::wstring(buffer.data(), length);
}

BY_HANDLE_FILE_INFORMATION identity(HANDLE handle) {
  BY_HANDLE_FILE_INFORMATION info{};
  if (!GetFileInformationByHandle(handle, &info)) fail("E_PARENT_IDENTITY", GetLastError());
  return info;
}

bool sameIdentity(const BY_HANDLE_FILE_INFORMATION& a, const BY_HANDLE_FILE_INFORMATION& b) {
  return a.dwVolumeSerialNumber == b.dwVolumeSerialNumber &&
      a.nFileIndexHigh == b.nFileIndexHigh && a.nFileIndexLow == b.nFileIndexLow;
}

void verifyLocalFileSystem(const std::wstring& physicalPath) {
  std::vector<wchar_t> volumePath(32768);
  if (!GetVolumePathNameW(physicalPath.c_str(), volumePath.data(),
                          static_cast<DWORD>(volumePath.size())))
    fail("E_PARENT_FILESYSTEM", GetLastError());
  if (GetDriveTypeW(volumePath.data()) != DRIVE_FIXED)
    fail("E_PARENT_FILESYSTEM_UNSUPPORTED", ERROR_NOT_SUPPORTED, ParentLockErrorCategory::Unsupported);
  wchar_t fileSystem[64]{};
  if (!GetVolumeInformationW(volumePath.data(), nullptr, 0, nullptr, nullptr, nullptr,
                             fileSystem, static_cast<DWORD>(std::size(fileSystem))))
    fail("E_PARENT_FILESYSTEM", GetLastError());
  if (_wcsicmp(fileSystem, L"NTFS") != 0 && _wcsicmp(fileSystem, L"ReFS") != 0)
    fail("E_PARENT_FILESYSTEM_UNSUPPORTED", ERROR_NOT_SUPPORTED, ParentLockErrorCategory::Unsupported);
}

std::wstring currentSidText() {
  Handle token;
  TokenUserBuffer buffer;
  PSID sid = tokenUserSid(buffer, token);
  LPWSTR text = nullptr;
  if (!ConvertSidToStringSidW(sid, &text)) fail("E_PARENT_TOKEN", GetLastError());
  std::wstring result(text);
  LocalFree(text);
  return result;
}

PSECURITY_DESCRIPTOR protectedDescriptor(const std::wstring& userSid) {
  const std::wstring sddl = L"O:" + userSid + L"D:P(A;;FA;;;" + userSid + L")(A;;FA;;;SY)";
  PSECURITY_DESCRIPTOR descriptor = nullptr;
  if (!ConvertStringSecurityDescriptorToSecurityDescriptorW(
          sddl.c_str(), SDDL_REVISION_1, &descriptor, nullptr))
    fail("E_PARENT_DESCRIPTOR", GetLastError());
  return descriptor;
}

void verifyParentPathIdentity(const std::wstring& physicalPath,
                              const BY_HANDLE_FILE_INFORMATION& expected) {
  Handle reopened(openDirectory(physicalPath, READ_CONTROL | FILE_READ_ATTRIBUTES |
      FILE_LIST_DIRECTORY | FILE_ADD_FILE));
  inspectObject(reopened.get(), true, false,
      READ_CONTROL | FILE_LIST_DIRECTORY | FILE_ADD_FILE | FILE_READ_ATTRIBUTES);
  if (!sameIdentity(expected, identity(reopened.get())))
    fail("E_PARENT_IDENTITY_CHANGED", ERROR_ACCESS_DENIED, ParentLockErrorCategory::Ambiguous);
}

}  // namespace

ParentLock::ParentLock(const std::wstring& parentPath) {
  if (parentPath.empty() || parentPath.find(L'\0') != std::wstring::npos)
    fail("E_PARENT_PATH", ERROR_INVALID_NAME, ParentLockErrorCategory::Malformed);
  constexpr DWORD parentAccess = READ_CONTROL | FILE_READ_ATTRIBUTES |
      FILE_LIST_DIRECTORY | FILE_ADD_FILE;
  Handle parent(openDirectory(parentPath, parentAccess));
  inspectObject(parent.get(), true, false, parentAccess);
  const auto parentInfo = identity(parent.get());
  std::wstring physicalPath = finalPath(parent.get());
  while (physicalPath.size() > 7 &&
         (physicalPath.back() == L'\\' || physicalPath.back() == L'/'))
    physicalPath.pop_back();
  verifyLocalFileSystem(physicalPath);
  verifyParentPathIdentity(physicalPath, parentInfo);

  const std::wstring lockPath = physicalPath +
      (physicalPath.back() == L'\\' ? L"" : L"\\") +
      L".svger-recovery-parent.lock";
  const std::wstring userSid = currentSidText();
  PSECURITY_DESCRIPTOR descriptor = protectedDescriptor(userSid);
  SECURITY_ATTRIBUTES attributes{sizeof(attributes), descriptor, FALSE};
  HANDLE rawLock = CreateFileW(lockPath.c_str(),
      GENERIC_READ | GENERIC_WRITE | READ_CONTROL | FILE_READ_ATTRIBUTES,
      0, &attributes, CREATE_NEW,
      FILE_ATTRIBUTE_HIDDEN | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  DWORD creationError = GetLastError();
  LocalFree(descriptor);
  if (rawLock == INVALID_HANDLE_VALUE &&
      (creationError == ERROR_FILE_EXISTS || creationError == ERROR_ALREADY_EXISTS)) {
    rawLock = CreateFileW(lockPath.c_str(),
        GENERIC_READ | GENERIC_WRITE | READ_CONTROL | FILE_READ_ATTRIBUTES,
        0, nullptr, OPEN_EXISTING,
        FILE_ATTRIBUTE_HIDDEN | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  }
  if (rawLock == INVALID_HANDLE_VALUE) {
    const DWORD error = GetLastError();
    if (error == ERROR_SHARING_VIOLATION || error == ERROR_LOCK_VIOLATION)
      fail("E_PARENT_LOCK_BUSY", error, ParentLockErrorCategory::Busy);
    fail("E_PARENT_LOCK_OPEN", error);
  }
  Handle lock(rawLock);
  inspectObject(lock.get(), false, true,
      READ_CONTROL | FILE_READ_DATA | FILE_WRITE_DATA | FILE_READ_ATTRIBUTES);
  verifyParentPathIdentity(physicalPath, parentInfo);
  const auto finalLockPath = finalPath(lock.get());
  if (_wcsicmp(finalLockPath.c_str(), lockPath.c_str()) != 0)
    fail("E_PARENT_LOCK_IDENTITY", ERROR_ACCESS_DENIED, ParentLockErrorCategory::Ambiguous);

  physicalPath_ = std::move(physicalPath);
  volumeSerial_ = parentInfo.dwVolumeSerialNumber;
  fileIndexHigh_ = parentInfo.nFileIndexHigh;
  fileIndexLow_ = parentInfo.nFileIndexLow;
  parent_ = parent.release();
  lock_ = lock.release();
  g_authorizationHandles.fetch_add(2, std::memory_order_relaxed);
}

ParentLock::~ParentLock() {
  if (lock_ != INVALID_HANDLE_VALUE && lock_ != nullptr) {
    CloseHandle(lock_);
    lock_ = INVALID_HANDLE_VALUE;
    g_authorizationHandles.fetch_sub(1, std::memory_order_relaxed);
  }
  if (parent_ != INVALID_HANDLE_VALUE && parent_ != nullptr) {
    CloseHandle(parent_);
    parent_ = INVALID_HANDLE_VALUE;
    g_authorizationHandles.fetch_sub(1, std::memory_order_relaxed);
  }
}

void ParentLock::close() {
  DWORD error = ERROR_SUCCESS;
  if (lock_ != INVALID_HANDLE_VALUE && lock_ != nullptr) {
    HANDLE current = lock_;
    lock_ = INVALID_HANDLE_VALUE;
    if (!CloseHandle(current)) error = GetLastError();
    g_authorizationHandles.fetch_sub(1, std::memory_order_relaxed);
  }
  if (parent_ != INVALID_HANDLE_VALUE && parent_ != nullptr) {
    HANDLE current = parent_;
    parent_ = INVALID_HANDLE_VALUE;
    if (!CloseHandle(current) && error == ERROR_SUCCESS) error = GetLastError();
    g_authorizationHandles.fetch_sub(1, std::memory_order_relaxed);
  }
  if (error != ERROR_SUCCESS) fail("E_PARENT_LOCK_CLOSE", error);
}

uint32_t liveAuthorizationHandleCount() {
  return g_authorizationHandles.load(std::memory_order_relaxed);
}
