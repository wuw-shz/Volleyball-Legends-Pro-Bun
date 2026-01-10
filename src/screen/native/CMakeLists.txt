cmake_minimum_required(VERSION 3.16)
project(dxgi-capture LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(dxgi-capture SHARED
    dxgi-capture.cpp
)

target_link_libraries(dxgi-capture PRIVATE
    d3d11
    dxgi
)

target_compile_definitions(dxgi-capture PRIVATE DXGI_CAPTURE_EXPORTS)

if(MSVC)
    target_compile_options(dxgi-capture PRIVATE /O2 /GL)
    target_link_options(dxgi-capture PRIVATE /LTCG)
else()
    target_compile_options(dxgi-capture PRIVATE -O3)
endif()

set_target_properties(dxgi-capture PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}"
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}"
)
