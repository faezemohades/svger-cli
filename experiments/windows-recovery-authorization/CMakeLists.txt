cmake_minimum_required(VERSION 3.20)
project(svger_windows_recovery_poc LANGUAGES CXX)

if(NOT WIN32)
  message(FATAL_ERROR "This proof of concept is Windows-only.")
endif()

add_executable(svger-recovery-poc src/poc.cpp)
target_compile_features(svger-recovery-poc PRIVATE cxx_std_17)
target_link_libraries(svger-recovery-poc PRIVATE Advapi32)

if(MSVC)
  target_compile_options(svger-recovery-poc PRIVATE /W4 /WX /permissive-)
endif()
