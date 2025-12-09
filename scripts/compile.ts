import { build, CompileBuildConfig } from "bun";
import { buildConfig } from "./build";

export async function runCompile(): Promise<boolean> {
  console.time("compile");
  console.log("Compiling...");

  const config: CompileBuildConfig = {
    ...buildConfig,
    splitting: undefined,
    sourcemap: "none",
    compile: {
      target: "bun-windows-x64",
      outfile: "vbl-pro-bun",
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
