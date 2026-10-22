cmake_minimum_required(VERSION 3.24)
project(svger_recovery_session LANGUAGES CXX)

if(NOT WIN32)
  message(FATAL_ERROR "The isolated Node-API session prototype currently targets Windows only.")
endif()

set(NODE_API_INCLUDE_DIR "" CACHE PATH "Directory containing node_api.h")
if(NOT NODE_API_INCLUDE_DIR OR NOT EXISTS "${NODE_API_INCLUDE_DIR}/node_api.h")
  message(FATAL_ERROR "Set NODE_API_INCLUDE_DIR to the Node.js include/node directory.")
endif()

set(NODE_IMPORT_LIBRARY "" CACHE FILEPATH "Matching Windows Node.js import library")
if(NOT NODE_IMPORT_LIBRARY OR NOT EXISTS "${NODE_IMPORT_LIBRARY}")
  message(FATAL_ERROR "Set NODE_IMPORT_LIBRARY to the matching node.lib.")
endif()

add_library(svger_recovery_session MODULE src/addon.cpp)
target_include_directories(svger_recovery_session PRIVATE "${NODE_API_INCLUDE_DIR}")
target_link_libraries(svger_recovery_session PRIVATE "${NODE_IMPORT_LIBRARY}")
target_compile_features(svger_recovery_session PRIVATE cxx_std_17)
target_compile_definitions(svger_recovery_session PRIVATE
  NAPI_VERSION=8
  NODE_GYP_MODULE_NAME=svger_recovery_session
  NOMINMAX
  WIN32_LEAN_AND_MEAN
)
set_target_properties(svger_recovery_session PROPERTIES
  PREFIX ""
  SUFFIX ".node"
  CXX_VISIBILITY_PRESET hidden
  VISIBILITY_INLINES_HIDDEN YES
)
