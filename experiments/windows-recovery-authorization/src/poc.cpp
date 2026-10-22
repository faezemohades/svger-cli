#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <aclapi.h>
#include <sddl.h>

#include <algorithm>
#include <chrono>
#include <cstring>
#include <cstdlib>
#include <filesystem>
#include <cwchar>
#include <iostream>
#include <string>
#include <thread>
#include <vector>

namespace {

struct Failure {
  const char* code;
  DWORD error;
};

struct Handle {
  HANDLE value = INVALID_HANDLE_VALUE;
  Handle() = default;
  explicit Handle(HANDLE h) : value(h) {}
  ~Handle() { if (value != INVALID_HANDLE_VALUE && value != nullptr) CloseHandle(value); }
  Handle(const Handle&) = delete;
  Handle& operator=(const Handle&) = delete;
  Handle(Handle&& other) noexcept : value(other.value) { other.value = INVALID_HANDLE_VALUE; }
  Handle& operator=(Handle&& other) noexcept {
    if (this != &other) {
      if (value != INVALID_HANDLE_VALUE && value != nullptr) CloseHandle(value);
      value = other.value;
      other.value = INVALID_HANDLE_VALUE;
    }
    return *this;
  }
  explicit operator bool() const { return value != INVALID_HANDLE_VALUE && value != nullptr; }
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

struct TemporaryDirectoryCleanup {
  std::wstring path;
  ~TemporaryDirectoryCleanup() {
    std::error_code ignored;
    std::filesystem::remove_all(std::filesystem::path(path), ignored);
  }
};

[[noreturn]] void fail(const char* code, DWORD error = GetLastError()) {
  throw Failure{code, error};
}

std::wstring currentUserSid() {
  Handle token;
  HANDLE raw = nullptr;
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &raw)) fail("token_open_failed");
  token = Handle(raw);
  DWORD needed = 0;
  GetTokenInformation(token.value, TokenUser, nullptr, 0, &needed);
  if (GetLastError() != ERROR_INSUFFICIENT_BUFFER || needed == 0) fail("token_user_size_failed");
  TokenUserBuffer buffer;
  buffer.bytes.resize(needed);
  if (!GetTokenInformation(token.value, TokenUser, buffer.get(), needed, &needed)) fail("token_user_failed");
  LPWSTR text = nullptr;
  if (!ConvertSidToStringSidW(buffer.get()->User.Sid, &text)) fail("sid_string_failed");
  std::wstring result(text);
  LocalFree(text);
  return result;
}

PSID sidFromString(const std::wstring& text, LocalMemory& memory) {
  PSID sid = nullptr;
  if (!ConvertStringSidToSidW(text.c_str(), &sid)) fail("sid_parse_failed");
  memory.value = sid;
  return sid;
}

bool equalSid(PSID a, PSID b) { return a && b && EqualSid(a, b) != FALSE; }

bool dangerousWriteMask(DWORD mask) {
  GENERIC_MAPPING mapping{FILE_GENERIC_READ, FILE_GENERIC_WRITE, FILE_GENERIC_EXECUTE, FILE_ALL_ACCESS};
  MapGenericMask(&mask, &mapping);
  constexpr DWORD dangerous = FILE_WRITE_DATA | FILE_APPEND_DATA | FILE_WRITE_EA |
      FILE_WRITE_ATTRIBUTES | FILE_DELETE_CHILD | DELETE | WRITE_DAC | WRITE_OWNER;
  return (mask & dangerous) != 0;
}

void inspectHandle(HANDLE file, bool directory, bool requireProtectedDacl = true) {
  BY_HANDLE_FILE_INFORMATION info{};
  if (!GetFileInformationByHandle(file, &info)) fail("file_identity_failed");
  if ((info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0) fail("reparse_point_rejected");
  if (directory != ((info.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0)) fail("object_type_mismatch");

  PSID owner = nullptr;
  PACL dacl = nullptr;
  PSECURITY_DESCRIPTOR descriptor = nullptr;
  DWORD status = GetSecurityInfo(file, SE_FILE_OBJECT,
      OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
      &owner, nullptr, &dacl, nullptr, &descriptor);
  LocalMemory descriptorMemory;
  descriptorMemory.value = descriptor;
  if (status != ERROR_SUCCESS) fail("security_descriptor_read_failed", status);
  if (!owner || !dacl) fail("owner_or_dacl_missing", ERROR_INVALID_SECURITY_DESCR);
  SECURITY_DESCRIPTOR_CONTROL control = 0;
  DWORD revision = 0;
  if (!GetSecurityDescriptorControl(descriptor, &control, &revision)) fail("sd_control_read_failed");

  LocalMemory currentMemory, systemMemory;
  PSID current = sidFromString(currentUserSid(), currentMemory);
  PSID system = sidFromString(L"S-1-5-18", systemMemory);
  if (!equalSid(owner, current)) fail("owner_mismatch", ERROR_ACCESS_DENIED);

  ACL_SIZE_INFORMATION aclInfo{};
  if (!GetAclInformation(dacl, &aclInfo, static_cast<DWORD>(sizeof(aclInfo)), AclSizeInformation))
    fail("dacl_read_failed");
  for (DWORD i = 0; i < aclInfo.AceCount; ++i) {
    void* rawAce = nullptr;
    if (!GetAce(dacl, i, &rawAce)) fail("ace_read_failed");
    auto* header = static_cast<ACE_HEADER*>(rawAce);
    PSID trustee = nullptr;
    DWORD mask = 0;
    if (header->AceType == ACCESS_ALLOWED_ACE_TYPE) {
      auto* ace = static_cast<ACCESS_ALLOWED_ACE*>(rawAce);
      mask = ace->Mask;
      trustee = &ace->SidStart;
      if (dangerousWriteMask(mask) && !equalSid(trustee, current) && !equalSid(trustee, system))
        fail((header->AceFlags & INHERITED_ACE) ? "untrusted_inherited_write_ace" : "untrusted_write_ace",
             ERROR_ACCESS_DENIED);
    } else if (header->AceType == ACCESS_DENIED_ACE_TYPE) {
      // Deny ACEs are evaluated by AccessCheck below. Unknown ACE layouts fail closed.
      auto* ace = static_cast<ACCESS_DENIED_ACE*>(rawAce);
      mask = ace->Mask;
      (void)mask;
    } else {
      fail("unsupported_ace_type", ERROR_NOT_SUPPORTED);
    }
  }
  if (requireProtectedDacl && (control & SE_DACL_PROTECTED) == 0)
    fail("dacl_not_protected", ERROR_ACCESS_DENIED);

  Handle token;
  HANDLE rawToken = nullptr;
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY | TOKEN_DUPLICATE, &rawToken)) fail("token_open_failed");
  token = Handle(rawToken);
  HANDLE rawImpersonation = nullptr;
  if (!DuplicateToken(token.value, SecurityImpersonation, &rawImpersonation)) fail("token_duplicate_failed");
  Handle impersonation(rawImpersonation);
  GENERIC_MAPPING mapping{FILE_GENERIC_READ, FILE_GENERIC_WRITE, FILE_GENERIC_EXECUTE, FILE_ALL_ACCESS};
  DWORD desired = READ_CONTROL | WRITE_DAC | WRITE_OWNER | DELETE |
      FILE_READ_DATA | FILE_WRITE_DATA | FILE_APPEND_DATA | FILE_READ_EA |
      FILE_WRITE_EA | FILE_READ_ATTRIBUTES | FILE_WRITE_ATTRIBUTES;
  if (directory) desired |= FILE_LIST_DIRECTORY | FILE_ADD_FILE | FILE_ADD_SUBDIRECTORY | FILE_DELETE_CHILD;
  MapGenericMask(&desired, &mapping);
  PRIVILEGE_SET privileges{};
  DWORD privilegeBytes = static_cast<DWORD>(sizeof(privileges)), granted = 0;
  BOOL access = FALSE;
  if (!AccessCheck(descriptor, impersonation.value, desired, &mapping, &privileges,
                   &privilegeBytes, &granted, &access)) {
    if (GetLastError() != ERROR_INSUFFICIENT_BUFFER) fail("access_check_failed");
    std::vector<unsigned char> storage(privilegeBytes);
    auto* expanded = reinterpret_cast<PRIVILEGE_SET*>(storage.data());
    if (!AccessCheck(descriptor, impersonation.value, desired, &mapping, expanded,
                     &privilegeBytes, &granted, &access)) fail("access_check_failed");
  }
  if (!access) fail("current_user_lacks_required_access", ERROR_ACCESS_DENIED);
}

PSECURITY_DESCRIPTOR protectedDescriptor(std::wstring& userSidText) {
  const std::wstring sddl = L"O:" + userSidText + L"D:P(A;;FA;;;" + userSidText + L")(A;;FA;;;SY)";
  PSECURITY_DESCRIPTOR descriptor = nullptr;
  if (!ConvertStringSecurityDescriptorToSecurityDescriptorW(
          sddl.c_str(), SDDL_REVISION_1, &descriptor, nullptr))
    fail("sd_construct_failed");
  return descriptor;
}

Handle openNoFollow(const std::wstring& path, DWORD access, bool directory) {
  DWORD flags = FILE_FLAG_OPEN_REPARSE_POINT | (directory ? FILE_FLAG_BACKUP_SEMANTICS : 0);
  HANDLE file = CreateFileW(path.c_str(), access, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                            nullptr, OPEN_EXISTING, flags, nullptr);
  if (file == INVALID_HANDLE_VALUE) fail("open_failed");
  return Handle(file);
}

std::wstring tempDirectory() {
  wchar_t buffer[MAX_PATH + 1]{};
  DWORD length = GetTempPathW(MAX_PATH, buffer);
  if (!length || length > MAX_PATH) fail("temp_path_failed");
  return std::wstring(buffer, length);
}

std::wstring uniqueTempPath() {
  return tempDirectory() + L"svger-recovery-poc-" + std::to_wstring(GetCurrentProcessId()) + L"-" +
      std::to_wstring(GetTickCount64());
}

void makeDirectory(const std::wstring& path) {
  std::filesystem::path target(path);
  std::wstring parentPath = target.parent_path().wstring();
  if (parentPath.empty()) parentPath = std::filesystem::current_path().wstring();
  Handle parent = openNoFollow(parentPath,
      READ_CONTROL | FILE_LIST_DIRECTORY | FILE_ADD_SUBDIRECTORY | FILE_DELETE_CHILD, true);
  inspectHandle(parent.value, true, false);

  std::wstring user = currentUserSid();
  PSECURITY_DESCRIPTOR descriptor = protectedDescriptor(user);
  SECURITY_ATTRIBUTES attributes{sizeof(attributes), descriptor, FALSE};
  BOOL ok = CreateDirectoryW(path.c_str(), &attributes);
  DWORD error = GetLastError();
  LocalFree(descriptor);
  if (!ok) fail("protected_directory_create_failed", error);
  Handle dir = openNoFollow(path, READ_CONTROL | FILE_LIST_DIRECTORY | FILE_ADD_FILE | FILE_DELETE_CHILD, true);
  inspectHandle(dir.value, true);
}

Handle createFileProtected(const std::wstring& path) {
  std::filesystem::path target(path);
  std::wstring parentPath = target.parent_path().wstring();
  if (parentPath.empty()) parentPath = std::filesystem::current_path().wstring();
  Handle parent = openNoFollow(parentPath,
      READ_CONTROL | FILE_LIST_DIRECTORY | FILE_ADD_FILE | FILE_DELETE_CHILD, true);
  inspectHandle(parent.value, true, false);

  std::wstring user = currentUserSid();
  PSECURITY_DESCRIPTOR descriptor = protectedDescriptor(user);
  SECURITY_ATTRIBUTES attributes{sizeof(attributes), descriptor, FALSE};
  HANDLE file = CreateFileW(path.c_str(), GENERIC_READ | GENERIC_WRITE | DELETE | READ_CONTROL | WRITE_DAC | WRITE_OWNER,
                            0, &attributes, CREATE_NEW, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  DWORD error = GetLastError();
  LocalFree(descriptor);
  if (file == INVALID_HANDLE_VALUE) fail("protected_file_create_failed", error);
  Handle result(file);
  inspectHandle(result.value, false);
  return result;
}

void renameOpenHandle(HANDLE sourceHandle, const std::wstring& destinationDirectory,
                      const std::wstring& destinationName) {
  Handle directory = openNoFollow(destinationDirectory,
      READ_CONTROL | FILE_ADD_FILE | FILE_LIST_DIRECTORY, true);
  inspectHandle(directory.value, true);
  const size_t nameBytes = destinationName.size() * sizeof(wchar_t);
  std::vector<unsigned char> storage(sizeof(FILE_RENAME_INFO) + nameBytes);
  auto* info = reinterpret_cast<FILE_RENAME_INFO*>(storage.data());
  info->ReplaceIfExists = FALSE;
  info->RootDirectory = directory.value;
  info->FileNameLength = static_cast<DWORD>(nameBytes);
  memcpy(info->FileName, destinationName.data(), nameBytes);
  if (!SetFileInformationByHandle(sourceHandle, FileRenameInfo, info,
                                  static_cast<DWORD>(storage.size()))) fail("handle_rename_failed");
}

void deleteByHandle(const std::wstring& filePath) {
  Handle file = openNoFollow(filePath, DELETE | READ_CONTROL | FILE_READ_ATTRIBUTES, false);
  inspectHandle(file.value, false);
  FILE_DISPOSITION_INFO disposition{TRUE};
  if (!SetFileInformationByHandle(file.value, FileDispositionInfo, &disposition,
                                  static_cast<DWORD>(sizeof(disposition))))
    fail("handle_delete_failed");
}

Handle acquireExclusiveLock(const std::wstring& lockPath) {
  std::filesystem::path lockFile(lockPath);
  std::wstring parentPath = lockFile.parent_path().wstring();
  if (parentPath.empty()) parentPath = std::filesystem::current_path().wstring();
  Handle parent = openNoFollow(parentPath,
      READ_CONTROL | FILE_LIST_DIRECTORY | FILE_ADD_FILE | FILE_DELETE_CHILD, true);
  inspectHandle(parent.value, true);

  std::wstring user = currentUserSid();
  PSECURITY_DESCRIPTOR descriptor = protectedDescriptor(user);
  SECURITY_ATTRIBUTES attributes{sizeof(attributes), descriptor, FALSE};
  HANDLE raw = CreateFileW(lockPath.c_str(), GENERIC_READ | GENERIC_WRITE | DELETE | READ_CONTROL,
                           0, &attributes, CREATE_NEW,
                           FILE_ATTRIBUTE_HIDDEN | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  DWORD createError = GetLastError();
  LocalFree(descriptor);
  if (raw == INVALID_HANDLE_VALUE && (createError == ERROR_FILE_EXISTS || createError == ERROR_ALREADY_EXISTS)) {
    raw = CreateFileW(lockPath.c_str(), GENERIC_READ | GENERIC_WRITE | DELETE | READ_CONTROL,
                      0, nullptr, OPEN_EXISTING,
                      FILE_ATTRIBUTE_HIDDEN | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  }
  if (raw == INVALID_HANDLE_VALUE) {
    DWORD error = GetLastError();
    if (error == ERROR_SHARING_VIOLATION || error == ERROR_LOCK_VIOLATION) fail("lock_busy", error);
    fail("lock_open_failed", error);
  }
  Handle file(raw);
  inspectHandle(file.value, false);
  return file;
}

void selfTest() {
  const std::wstring root = uniqueTempPath();
  TemporaryDirectoryCleanup cleanup{root};
  (void)cleanup;
  makeDirectory(root);
  const std::wstring first = root + L"\\stage.tmp";
  const std::wstring second = root + L"\\renamed.tmp";
  const std::wstring lock = root + L"\\parent.lock";
  {
    Handle staged = createFileProtected(first);
    const char payload[] = "disposable-poc";
    DWORD written = 0;
    if (!WriteFile(staged.value, payload, static_cast<DWORD>(sizeof(payload)), &written, nullptr) ||
        written != static_cast<DWORD>(sizeof(payload)))
      fail("fixture_write_failed");
  }
  Handle pinned = openNoFollow(first, DELETE | READ_CONTROL | FILE_READ_ATTRIBUTES, false);
  inspectHandle(pinned.value, false);
  const std::wstring movedOriginal = root + L"\\moved-original.tmp";
  if (!MoveFileExW(first.c_str(), movedOriginal.c_str(), MOVEFILE_WRITE_THROUGH))
    fail("fixture_path_substitution_failed");
  Handle replacement(CreateFileW(first.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_NEW,
      FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
  if (!replacement) fail("fixture_replacement_create_failed");
  const char replacementPayload[] = "replacement";
  DWORD replacementWritten = 0;
  if (!WriteFile(replacement.value, replacementPayload,
                 static_cast<DWORD>(sizeof(replacementPayload)),
                 &replacementWritten, nullptr) ||
      replacementWritten != static_cast<DWORD>(sizeof(replacementPayload)))
    fail("fixture_replacement_write_failed");
  replacement = Handle();
  renameOpenHandle(pinned.value, root, L"renamed.tmp");
  pinned = Handle();
  {
    Handle renamed = openNoFollow(second, GENERIC_READ | READ_CONTROL | WRITE_DAC, false);
    inspectHandle(renamed.value, false);
    char observed[32]{};
    DWORD read = 0;
    if (!ReadFile(renamed.value, observed, sizeof(observed), &read, nullptr) ||
        std::string(observed, observed + read).find("disposable-poc") != 0)
      fail("handle_rename_changed_identity", ERROR_INVALID_DATA);

    LocalMemory everyoneMemory, updatedAclMemory;
    LocalMemory originalDescriptorMemory;
    PSID everyone = sidFromString(L"S-1-1-0", everyoneMemory);
    PACL originalDacl = nullptr;
    PSECURITY_DESCRIPTOR originalDescriptor = nullptr;
    DWORD readStatus = GetSecurityInfo(renamed.value, SE_FILE_OBJECT,
        DACL_SECURITY_INFORMATION, nullptr, nullptr, &originalDacl, nullptr,
        &originalDescriptor);
    originalDescriptorMemory.value = originalDescriptor;
    if (readStatus != ERROR_SUCCESS) fail("fixture_original_acl_read_failed", readStatus);
    EXPLICIT_ACCESSW entry{};
    entry.grfAccessPermissions = FILE_GENERIC_WRITE;
    entry.grfAccessMode = GRANT_ACCESS;
    entry.grfInheritance = NO_INHERITANCE;
    entry.Trustee.TrusteeForm = TRUSTEE_IS_SID;
    entry.Trustee.TrusteeType = TRUSTEE_IS_WELL_KNOWN_GROUP;
    entry.Trustee.ptstrName = static_cast<LPWSTR>(everyone);
    PACL updatedAcl = nullptr;
    DWORD aclStatus = SetEntriesInAclW(1, &entry, originalDacl, &updatedAcl);
    if (aclStatus != ERROR_SUCCESS) fail("fixture_acl_build_failed", aclStatus);
    updatedAclMemory.value = updatedAcl;
    aclStatus = SetSecurityInfo(renamed.value, SE_FILE_OBJECT,
        DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
        nullptr, nullptr, updatedAcl, nullptr);
    if (aclStatus != ERROR_SUCCESS) fail("fixture_acl_apply_failed", aclStatus);
    try {
      inspectHandle(renamed.value, false);
      fail("everyone_write_ace_was_accepted", ERROR_ACCESS_DENIED);
    } catch (const Failure& failure) {
      if (std::string(failure.code) != "untrusted_write_ace") throw;
    }
    aclStatus = SetSecurityInfo(renamed.value, SE_FILE_OBJECT,
        DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
        nullptr, nullptr, originalDacl, nullptr);
    if (aclStatus != ERROR_SUCCESS) fail("fixture_acl_restore_failed", aclStatus);
  }
  if (!DeleteFileW(first.c_str())) fail("fixture_replacement_cleanup_failed");
  deleteByHandle(second);
  {
    Handle lockHandle = acquireExclusiveLock(lock);
    (void)lockHandle;
    std::cout << "protected_create=PASS handle_rename=PASS handle_delete=PASS lock_acquire=PASS\n";
  }
  // Remove only this fresh, uniquely named disposable fixture.
  (void)lock;
  std::cout << "path_substitution_identity=PASS\n";
}

} // namespace

int wmain(int argc, wchar_t** argv) {
  try {
  if (argc == 2 && std::wstring(argv[1]) == L"self-test") { selfTest(); return 0; }
  if (argc == 3 && std::wstring(argv[1]) == L"create-file") {
    Handle file = createFileProtected(argv[2]);
    (void)file;
    std::cout << "protected_create=PASS\n";
    return 0;
  }
  if (argc == 3 && std::wstring(argv[1]) == L"create-dir") {
    makeDirectory(argv[2]);
    std::cout << "protected_create=PASS\n";
    return 0;
  }
  if (argc == 3 && (std::wstring(argv[1]) == L"inspect-file" || std::wstring(argv[1]) == L"inspect-dir")) {
    bool directory = std::wstring(argv[1]) == L"inspect-dir";
    Handle object = openNoFollow(argv[2], READ_CONTROL | FILE_READ_ATTRIBUTES, directory);
    inspectHandle(object.value, directory);
    std::cout << "authorized=PASS\n";
    return 0;
  }
  if (argc == 4 && std::wstring(argv[1]) == L"hold-lock") {
    Handle lock = acquireExclusiveLock(argv[2]);
    (void)lock;
    std::wcout << L"lock_acquired\n";
    std::wcout.flush();
    std::this_thread::sleep_for(std::chrono::milliseconds(_wtoi(argv[3])));
    return 0;
  }
  if (argc == 3 && std::wstring(argv[1]) == L"try-lock") {
    Handle lock = acquireExclusiveLock(argv[2]);
    (void)lock;
    std::wcout << L"lock_acquired\n";
    return 0;
  }
  std::wcerr << L"usage: svger-recovery-poc.exe self-test | create-file <path> | create-dir <path> | inspect-file <path> | inspect-dir <path> | hold-lock <path> <ms> | try-lock <path>\n";
  return 64;
  } catch (const Failure& failure) {
    std::cerr << failure.code << " win32=" << failure.error << "\n";
    return 2;
  }
}
