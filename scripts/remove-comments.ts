import { Glob } from "bun";

const glob = new Glob("**/*.ts");
const excludeDirs = ["node_modules", "dist", "scripts"];

for await (const file of glob.scan({ cwd: ".", onlyFiles: true })) {
  // Skip excluded directories
  if (excludeDirs.some((dir) => file.startsWith(dir + "/"))) continue;

  const content = await Bun.file(file).text();

  // Remove comments while preserving strings
  const cleaned = removeComments(content);

  if (cleaned !== content) {
    await Bun.write(file, cleaned);
    console.log(`Cleaned: ${file}`);
  }
}

console.log("Done!");

function removeComments(code: string): string {
  let result = "";
  let i = 0;

  while (i < code.length) {
    // Handle strings (single, double, template)
    if (code[i] === '"' || code[i] === "'" || code[i] === "`") {
      const quote = code[i];
      result += code[i++];

      while (i < code.length && code[i] !== quote) {
        if (code[i] === "\\") {
          result += code[i++];
          if (i < code.length) result += code[i++];
        } else {
          result += code[i++];
        }
      }
      if (i < code.length) result += code[i++];
    }
    // Handle single-line comments
    else if (code[i] === "/" && code[i + 1] === "/") {
      // Skip until newline
      while (i < code.length && code[i] !== "\n") i++;
    }
    // Handle multi-line comments
    else if (code[i] === "/" && code[i + 1] === "*") {
      i += 2;
      while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) i++;
      i += 2;
    }
    // Handle regex literals
    else if (code[i] === "/" && isRegexStart(code, i)) {
      result += code[i++];
      while (i < code.length && code[i] !== "/") {
        if (code[i] === "\\") {
          result += code[i++];
          if (i < code.length) result += code[i++];
        } else {
          result += code[i++];
        }
      }
      if (i < code.length) result += code[i++];
      // Include regex flags
      while (i < code.length && /[gimsuy]/.test(code[i])) {
        result += code[i++];
      }
    }
    // Normal character
    else {
      result += code[i++];
    }
  }

  // Clean up empty lines left by removed comments
  return (
    result
      .split("\n")
      .filter((line) => line.trim() !== "")
      .join("\n") + "\n"
  );
}

function isRegexStart(code: string, i: number): boolean {
  // Look back to see if this could be a regex
  let j = i - 1;
  while (j >= 0 && /\s/.test(code[j])) j--;
  if (j < 0) return true;

  const prevChar = code[j];
  // After these, a / is likely a regex
  return /[=(:,\[!&|?{};]/.test(prevChar);
}
