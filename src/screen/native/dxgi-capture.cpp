#define DXGI_CAPTURE_EXPORTS
#include "dxgi-capture.h"

#include <d3d11.h>
#include <dxgi1_2.h>
#include <cstring>

#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")

static ID3D11Device* g_device = nullptr;
static ID3D11DeviceContext* g_context = nullptr;
static IDXGIOutputDuplication* g_duplication = nullptr;
static ID3D11Texture2D* g_stagingTexture = nullptr;
static int g_width = 0;
static int g_height = 0;
static int g_stagingW = 0;
static int g_stagingH = 0;
static bool g_initialized = false;

template<typename T>
static void SafeRelease(T** ppT) {
    if (*ppT) {
        (*ppT)->Release();
        *ppT = nullptr;
    }
}

DXGI_API bool dxgi_init(int output_index) {
    if (g_initialized) return true;

    HRESULT hr;

    D3D_FEATURE_LEVEL featureLevel;
    hr = D3D11CreateDevice(
        nullptr,
        D3D_DRIVER_TYPE_HARDWARE,
        nullptr,
        0,
        nullptr, 0,
        D3D11_SDK_VERSION,
        &g_device,
        &featureLevel,
        &g_context
    );
    if (FAILED(hr)) return false;

    IDXGIDevice* dxgiDevice = nullptr;
    hr = g_device->QueryInterface(__uuidof(IDXGIDevice), (void**)&dxgiDevice);
    if (FAILED(hr)) {
        dxgi_cleanup();
        return false;
    }

    IDXGIAdapter* adapter = nullptr;
    hr = dxgiDevice->GetAdapter(&adapter);
    SafeRelease(&dxgiDevice);
    if (FAILED(hr)) {
        dxgi_cleanup();
        return false;
    }

    IDXGIOutput* output = nullptr;
    hr = adapter->EnumOutputs(output_index, &output);
    SafeRelease(&adapter);
    if (FAILED(hr)) {
        dxgi_cleanup();
        return false;
    }

    IDXGIOutput1* output1 = nullptr;
    hr = output->QueryInterface(__uuidof(IDXGIOutput1), (void**)&output1);
    SafeRelease(&output);
    if (FAILED(hr)) {
        dxgi_cleanup();
        return false;
    }

    hr = output1->DuplicateOutput(g_device, &g_duplication);
    SafeRelease(&output1);
    if (FAILED(hr)) {
        dxgi_cleanup();
        return false;
    }

    DXGI_OUTDUPL_DESC desc;
    g_duplication->GetDesc(&desc);
    g_width = desc.ModeDesc.Width;
    g_height = desc.ModeDesc.Height;

    g_initialized = true;
    return true;
}

static bool ensureStagingTexture(int width, int height) {
    if (g_stagingTexture && g_stagingW == width && g_stagingH == height) {
        return true;
    }
    SafeRelease(&g_stagingTexture);
    
    D3D11_TEXTURE2D_DESC texDesc = {};
    texDesc.Width = width;
    texDesc.Height = height;
    texDesc.MipLevels = 1;
    texDesc.ArraySize = 1;
    texDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    texDesc.SampleDesc.Count = 1;
    texDesc.Usage = D3D11_USAGE_STAGING;
    texDesc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;

    if (FAILED(g_device->CreateTexture2D(&texDesc, nullptr, &g_stagingTexture))) {
        return false;
    }
    g_stagingW = width;
    g_stagingH = height;
    return true;
}

DXGI_API bool dxgi_capture(int x, int y, int width, int height, uint8_t* buffer) {
    if (!g_initialized || !buffer) return false;

    if (!ensureStagingTexture(width, height)) return false;

    DXGI_OUTDUPL_FRAME_INFO frameInfo;
    IDXGIResource* resource = nullptr;
    
    HRESULT hr = g_duplication->AcquireNextFrame(0, &frameInfo, &resource);
    if (hr == DXGI_ERROR_WAIT_TIMEOUT) {
        return false;
    }
    if (FAILED(hr)) {
        if (hr == DXGI_ERROR_ACCESS_LOST) {
            g_initialized = false;
            dxgi_cleanup();
        }
        return false;
    }

    ID3D11Texture2D* desktopTexture = nullptr;
    hr = resource->QueryInterface(__uuidof(ID3D11Texture2D), (void**)&desktopTexture);
    SafeRelease(&resource);
    if (FAILED(hr)) {
        g_duplication->ReleaseFrame();
        return false;
    }

    D3D11_BOX srcBox;
    srcBox.left = x;
    srcBox.top = y;
    srcBox.right = x + width;
    srcBox.bottom = y + height;
    srcBox.front = 0;
    srcBox.back = 1;

    if (srcBox.right > (UINT)g_width) srcBox.right = g_width;
    if (srcBox.bottom > (UINT)g_height) srcBox.bottom = g_height;

    g_context->CopySubresourceRegion(g_stagingTexture, 0, 0, 0, 0, desktopTexture, 0, &srcBox);
    SafeRelease(&desktopTexture);

    D3D11_MAPPED_SUBRESOURCE mapped;
    hr = g_context->Map(g_stagingTexture, 0, D3D11_MAP_READ, 0, &mapped);
    if (FAILED(hr)) {
        g_duplication->ReleaseFrame();
        return false;
    }

    const int actualWidth = srcBox.right - srcBox.left;
    const int actualHeight = srcBox.bottom - srcBox.top;
    const int dstPitch = actualWidth * 4;

    uint8_t* src = static_cast<uint8_t*>(mapped.pData);
    for (int row = 0; row < actualHeight; ++row) {
        memcpy(buffer + row * dstPitch, src + row * mapped.RowPitch, dstPitch);
    }

    g_context->Unmap(g_stagingTexture, 0);
    g_duplication->ReleaseFrame();

    return true;
}

DXGI_API int dxgi_get_width(void) {
    return g_width;
}

DXGI_API int dxgi_get_height(void) {
    return g_height;
}

DXGI_API void dxgi_cleanup(void) {
    SafeRelease(&g_stagingTexture);
    SafeRelease(&g_duplication);
    SafeRelease(&g_context);
    SafeRelease(&g_device);
    g_width = 0;
    g_height = 0;
    g_stagingW = 0;
    g_stagingH = 0;
    g_initialized = false;
}
