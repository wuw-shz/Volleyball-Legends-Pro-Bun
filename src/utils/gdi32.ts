import { FFIType, dlopen } from "bun:ffi";

export const gdi32 = dlopen("gdi32.dll", {
  GetPixel: {
    args: [FFIType.ptr, FFIType.int, FFIType.int],
    returns: FFIType.uint32_t,
  },
  CreatePen: {
    args: [FFIType.int, FFIType.int, FFIType.uint32_t],
    returns: FFIType.ptr,
  },
  SelectObject: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.ptr },
  MoveToEx: {
    args: [FFIType.ptr, FFIType.int, FFIType.int, FFIType.ptr],
    returns: FFIType.bool,
  },
  LineTo: {
    args: [FFIType.ptr, FFIType.int, FFIType.int],
    returns: FFIType.bool,
  },
  DeleteObject: { args: [FFIType.ptr], returns: FFIType.bool },

  CreateCompatibleDC: { args: [FFIType.ptr], returns: FFIType.ptr },
  CreateDIBSection: {
    args: [
      FFIType.ptr,
      FFIType.ptr,
      FFIType.uint32_t,
      FFIType.ptr,
      FFIType.ptr,
      FFIType.uint32_t,
    ],
    returns: FFIType.ptr,
  },
  DeleteDC: { args: [FFIType.ptr], returns: FFIType.bool },
  CreateSolidBrush: { args: [FFIType.uint32_t], returns: FFIType.ptr },
  CreateCompatibleBitmap: {
    args: [FFIType.ptr, FFIType.int, FFIType.int],
    returns: FFIType.ptr,
  },
  BitBlt: {
    args: [
      FFIType.ptr,
      FFIType.int,
      FFIType.int,
      FFIType.int,
      FFIType.int,
      FFIType.ptr,
      FFIType.int,
      FFIType.int,
      FFIType.uint32_t,
    ],
    returns: FFIType.bool,
  },
});
