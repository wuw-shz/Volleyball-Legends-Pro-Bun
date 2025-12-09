import { $ } from "bun";

export type RunMode = "build" | "compile" | "dev";

export async function runApp(mode: RunMode): Promise<void> {
  switch (mode) {
    case "build":
      await $`bun run dist/index.js`;
      break;
    case "compile":
      await $`./vbl-pro-bun.exe`;
      break;
    case "dev":
      await $`bun run src/index.ts`;
      break;
  }
}
