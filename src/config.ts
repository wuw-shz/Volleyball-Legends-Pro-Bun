import path, { dirname, join } from "path";
import { pathToFileURL } from "url";
import { parse } from "smol-toml";
import { LoggerClass } from "./utils";

const logger = new LoggerClass(["Config", "cyan"]);

export type SkillMode = "normal" | "boomjump" | "stealblock";

export interface AppConfig {
  skill_mode: SkillMode;
}

const VALID_SKILL_MODES: SkillMode[] = ["normal", "boomjump", "stealblock"];

const DEFAULT_CONFIG: AppConfig = {
  skill_mode: "normal",
};

const isCompiled = !path
  .basename(process.execPath)
  .toLowerCase()
  .startsWith("bun");
const configPath = isCompiled
  ? join(dirname(process.execPath), "config.toml")
  : join(process.cwd(), "config.toml");

let config: AppConfig = { ...DEFAULT_CONFIG };

function validateConfig(raw: Partial<AppConfig>): AppConfig {
  const merged: AppConfig = {
    ...DEFAULT_CONFIG,
    ...raw,
  };

  if (!VALID_SKILL_MODES.includes(merged.skill_mode)) {
    logger.error(
      `Invalid skill_mode: "${merged.skill_mode}". Valid values: ${VALID_SKILL_MODES.join(", ")}`,
    );
    process.exit(1);
  }

  return merged;
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const file = Bun.file(configPath);
    if (await file.exists()) {
      const text = await file.text();
      const parsed = parse(text) as Partial<AppConfig>;
      config = validateConfig(parsed);
      logger.info(`Config loaded from: ${pathToFileURL(configPath).href}`);
      logger.info(`Config: ${JSON.stringify(config)}`);
    } else {
      await saveConfig(DEFAULT_CONFIG);
      logger.info(`Config created at: ${pathToFileURL(configPath).href}`);
    }
  } catch (error) {
    logger.error("Error loading config:", error);
    logger.warn("Please fix your config.toml file and try again.");
    process.exit(1);
  }

  return config;
}

export function getConfig(): AppConfig {
  return config;
}

function generateTomlWithComments(cfg: AppConfig): string {
  return `skill_mode="${cfg.skill_mode}"  # ${VALID_SKILL_MODES.join(", ")}
`;
}

export async function saveConfig(newConfig: Partial<AppConfig>): Promise<void> {
  config = validateConfig({ ...config, ...newConfig });

  try {
    await Bun.write(configPath, generateTomlWithComments(config));
  } catch (error) {
    logger.error("Error saving config:", error);
  }
}

loadConfig();
