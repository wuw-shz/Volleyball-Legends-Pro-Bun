import { inspect } from "util";

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LoggerConfig {
  level: LogLevel;
  timestamps: boolean;
  colors: boolean;
}

type TagInput = string | [string, keyof typeof COLORS] | string[];

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
} as const;

type ColorKey = keyof typeof COLORS;

export class LoggerClass {
  private config: LoggerConfig = {
    level: LogLevel.INFO,
    timestamps: true,
    colors: true,
  };

  private tags: { name: string; color: ColorKey }[] = [];

  constructor(...inputs: TagInput[]) {
    this.tags = inputs.map((t) => {
      if (Array.isArray(t)) {
        const [name, color] = t;
        return {
          name,
          color: (color as ColorKey) ?? "magenta",
        };
      }
      return { name: t, color: "magenta" as ColorKey };
    });
  }

  configure(config: Partial<LoggerConfig>) {
    this.config = { ...this.config, ...config };
  }

  scoped(...inputs: TagInput[]) {
    const next = new LoggerClass(
      ...this.tags.map((t) => [t.name, t.color] as [string, ColorKey]),
      ...inputs,
    );
    next.configure(this.config);
    return next;
  }

  private getTimestamp(): string {
    if (!this.config.timestamps) return "";
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { hour12: false });
    const ms = now.getMilliseconds().toString().padStart(3, "0");
    return `${time}.${ms}`;
  }

  private colorize(color: ColorKey, text: string): string {
    if (!this.config.colors) return text;
    return `${COLORS[color]}${text}${COLORS.reset}`;
  }

  private format(level: string, color: ColorKey, ...args: unknown[]): string {
    const timestamp = this.getTimestamp();
    const prefix = timestamp ? `${this.colorize("dim", timestamp)} ` : "";
    const levelStr = this.colorize(color, `${level}`);

    const tagStr =
      this.tags.length > 0
        ? " " +
          this.tags.map((t) => this.colorize(t.color, `[${t.name}]`)).join(" ")
        : "";

    const message = args
      .map((arg) =>
        typeof arg === "object"
          ? inspect(arg, { colors: this.config.colors, depth: 3 })
          : String(arg),
      )
      .join(" ");

    return `${prefix}${COLORS.reset}${COLORS.bright}${levelStr}${COLORS.reset}${tagStr}${COLORS.reset} ${message}`;
  }

  debug(...args: unknown[]) {
    if (this.config.level <= LogLevel.DEBUG) {
      console.log(this.format("DEBUG", "cyan", ...args));
    }
  }

  info(...args: unknown[]) {
    if (this.config.level <= LogLevel.INFO) {
      console.log(this.format("INFO", "blue", ...args));
    }
  }

  success(...args: unknown[]) {
    if (this.config.level <= LogLevel.INFO) {
      console.log(this.format("SUCCESS", "green", ...args));
    }
  }

  warn(...args: unknown[]) {
    if (this.config.level <= LogLevel.WARN) {
      console.warn(this.format("WARN", "yellow", ...args));
    }
  }

  error(...args: unknown[]) {
    if (this.config.level <= LogLevel.ERROR) {
      console.error(this.format("ERROR", "red", ...args));
    }
  }

  state(name: string, value: unknown) {
    this.debug(`State changed: ${this.colorize("magenta", name)} =`, value);
  }

  listener(action: string, detail: string) {
    this.info(`${this.colorize("cyan", "→")} ${action}:`, detail);
  }

  detection(system: string, status: boolean) {
    const symbol = status ? "✓" : "✗";
    const color = status ? "green" : "red";
    this.info(
      `${this.colorize(color, symbol)} ${system}:`,
      status ? "Active" : "Inactive",
    );
  }

  divider(char: string = "─", length: number = 50) {
    console.log(this.colorize("gray", char.repeat(length)));
  }

  clear() {
    console.clear();
  }
}
