import { build, type CompileBuildConfig } from "bun";
import { buildConfig } from "./build";
import { rmSync, existsSync } from "fs";
import packageJson from "../package.json" with { type: "json" };

export async function runCompile(): Promise<boolean> {
  console.time("compile");
  console.log("Compiling...");

  if (existsSync("./build")) {
    rmSync("./build", { recursive: true });
  }

  const version = packageJson.version;
  const config: CompileBuildConfig = {
    ...buildConfig,
    outdir: "./build",
    splitting: undefined,
    sourcemap: "none",
    compile: {
      target: "bun-windows-x64",
      outfile: `vbl-pro-bun-v${version}`,
    },
  };

  const result = await build(config);

  if (!result.success) {
    console.error("Compile Failed:");
    console.error(result.logs);
  } else {
    console.log("Compile Complete.");
  }

  console.timeEnd("compile");
  console.log();
  return result.success;
}
