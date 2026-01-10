#pragma once

#include <cstdint>

#ifdef _WIN32
#ifdef DXGI_CAPTURE_EXPORTS
#define DXGI_API __declspec(dllexport)
#else
#define DXGI_API __declspec(dllimport)
#endif
#else
#define DXGI_API
#endif

extern "C" {

DXGI_API bool dxgi_init(int output_index);

DXGI_API bool dxgi_capture(int x, int y, int width, int height, uint8_t* buffer);

DXGI_API int dxgi_get_width(void);

DXGI_API int dxgi_get_height(void);

DXGI_API void dxgi_cleanup(void);

}
