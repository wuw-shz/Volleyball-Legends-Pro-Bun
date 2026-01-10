import { tmpdir } from "os";
import { join } from "path";
import { mkdir } from "fs/promises";
import { DXGI_DLL_BASE64 } from "./dxgi-dll-data";

const DLL_NAME = "dxgi-capture.dll";
const TEMP_DIR = join(tmpdir(), "vbl-pro");
const TEMP_DLL_PATH = join(TEMP_DIR, DLL_NAME);

export async function extractDxgiDll(): Promise<boolean> {
  try {
    await mkdir(TEMP_DIR, { recursive: true });

    const tempFile = Bun.file(TEMP_DLL_PATH);
    const expectedSize = atob(DXGI_DLL_BASE64).length;

    if (await tempFile.exists()) {
      const currentSize = tempFile.size;
      if (currentSize === expectedSize) {
        return true;
      }
    }

    const binaryString = atob(DXGI_DLL_BASE64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    await Bun.write(TEMP_DLL_PATH, bytes);
    return true;
  } catch {
    return false;
  }
}

export function getTempDllPath(): string {
  return TEMP_DLL_PATH;
}
