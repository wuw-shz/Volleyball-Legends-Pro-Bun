import { FFIType, dlopen } from "bun:ffi";

export const user32 = dlopen("user32.dll", {
  GetDC: { args: [FFIType.ptr], returns: FFIType.ptr },
  ReleaseDC: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.int },
  GetDesktopWindow: { args: [], returns: FFIType.ptr },
  GetForegroundWindow: { args: [], returns: FFIType.ptr },
  GetWindowTextW: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.int],
    returns: FFIType.int,
  },
  GetWindowRect: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.bool },
  GetSystemMetrics: { args: [FFIType.int], returns: FFIType.int },
  SetLayeredWindowAttributes: {
    args: [FFIType.ptr, FFIType.uint32_t, FFIType.int8_t, FFIType.uint32_t],
    returns: FFIType.bool,
  },
  UpdateLayeredWindow: {
    args: [
      FFIType.ptr,
      FFIType.ptr,
      FFIType.ptr,
      FFIType.ptr,
      FFIType.ptr,
      FFIType.ptr,
      FFIType.uint32_t,
      FFIType.ptr,
      FFIType.uint32_t,
    ],
    returns: FFIType.bool,
  },
  GetWindowLongW: { args: [FFIType.ptr, FFIType.int], returns: FFIType.int },
  CreateWindowExW: {
    args: [
      FFIType.uint32_t,
      FFIType.ptr,
      FFIType.ptr,
      FFIType.uint32_t,
      FFIType.int,
      FFIType.int,
      FFIType.int,
      FFIType.int,
      FFIType.ptr,
      FFIType.ptr,
      FFIType.ptr,
      FFIType.ptr,
    ],
    returns: FFIType.ptr,
  },
  ShowWindow: { args: [FFIType.ptr, FFIType.int], returns: FFIType.bool },
  UpdateWindow: { args: [FFIType.ptr], returns: FFIType.bool },
  SetWindowPos: {
    args: [
      FFIType.ptr,
      FFIType.ptr,
      FFIType.int,
      FFIType.int,
      FFIType.int,
      FFIType.int,
      FFIType.uint32_t,
    ],
    returns: FFIType.bool,
  },
  FindWindowA: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
  FillRect: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.ptr],
    returns: FFIType.int,
  },
});
