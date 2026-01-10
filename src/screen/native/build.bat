@echo off
echo Building dxgi-capture.dll...

if not exist build mkdir build
cd build

cmake -G "Visual Studio 17 2022" -A x64 ..
if errorlevel 1 (
    echo CMake configuration failed!
    pause
    exit /b 1
)

cmake --build . --config Release
if errorlevel 1 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo Build successful!
echo.

cd ..

echo Converting DLL to base64...
set DLL_PATH=Release\dxgi-capture.dll
set OUTPUT_PATH=..\dxgi-dll-data.ts

if not exist "%DLL_PATH%" (
    echo DLL not found at %DLL_PATH%
    pause
    exit /b 1
)

powershell -Command "$bytes = [IO.File]::ReadAllBytes('%DLL_PATH%'); $base64 = [Convert]::ToBase64String($bytes); 'export const DXGI_DLL_BASE64 = \"' + $base64 + '\";' | Out-File -FilePath '%OUTPUT_PATH%' -Encoding utf8"

if errorlevel 1 (
    echo Base64 conversion failed!
    pause
    exit /b 1
)

echo.
echo Successfully created dxgi-dll-data.ts
echo.
pause
