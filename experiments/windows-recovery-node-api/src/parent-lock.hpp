#pragma once

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>

#include <cstdint>
#include <memory>
#include <string>

enum class ParentLockErrorCategory { Authorization, Busy, Malformed, Ambiguous, Io, Unsupported };

struct ParentLockError {
  const char* code;
  DWORD win32;
  ParentLockErrorCategory category;
};

class ParentLock final {
 public:
  explicit ParentLock(const std::wstring& parentPath);
  ~ParentLock();
  ParentLock(const ParentLock&) = delete;
  ParentLock& operator=(const ParentLock&) = delete;

  void close();
  bool isOpen() const { return lock_ != nullptr && lock_ != INVALID_HANDLE_VALUE; }

 private:
  HANDLE parent_ = INVALID_HANDLE_VALUE;
  HANDLE lock_ = INVALID_HANDLE_VALUE;
  std::wstring physicalPath_;
  DWORD volumeSerial_ = 0;
  DWORD fileIndexHigh_ = 0;
  DWORD fileIndexLow_ = 0;
};

uint32_t liveAuthorizationHandleCount();
