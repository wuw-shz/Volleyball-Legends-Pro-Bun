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

type TagInput = string | [string, keyof LoggerClass["colors"]] | string[];

export class LoggerClass {
  private config: LoggerConfig = {
    level: LogLevel.INFO,
    timestamps: true,
    colors: true,
  };

  private tags: { name: string; color: keyof LoggerClass["colors"] }[] = [];

  protected colors = {
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
  };

  constructor(...inputs: TagInput[]) {
    this.tags = inputs.map((t) => {
      if (Array.isArray(t)) {
        const [name, color] = t;
        return {
          name,
          color: (color as keyof LoggerClass["colors"]) ?? "magenta",
        };
      }
      return { name: t, color: "magenta" };
    });
  }

  configure(config: Partial<LoggerConfig>) {
    this.config = { ...this.config, ...config };
  }

  scoped(...inputs: TagInput[]) {
    const next = new LoggerClass(
      ...this.tags.map((t) => [t.name, t.color]),
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

  private colorize(color: keyof typeof this.colors, text: string): string {
    if (!this.config.colors) return text;
    return `${this.colors[color]}${text}${this.colors.reset}`;
  }

  private format(
    level: string,
    color: keyof typeof this.colors,
    ...args: any[]
  ): string {
    const timestamp = this.getTimestamp();
    const prefix = timestamp ? `[${this.colorize("gray", timestamp)}] ` : "";
    const levelStr = this.colorize(color, `[${level}]`);

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

    return `${prefix}${levelStr}${tagStr} ${message}`;
  }

  debug(...args: any[]) {
    if (this.config.level <= LogLevel.DEBUG) {
      console.log(this.format("DEBUG", "cyan", ...args));
    }
  }

  info(...args: any[]) {
    if (this.config.level <= LogLevel.INFO) {
      console.log(this.format("INFO", "blue", ...args));
    }
  }

  success(...args: any[]) {
    if (this.config.level <= LogLevel.INFO) {
      console.log(this.format("SUCCESS", "green", ...args));
    }
  }

  warn(...args: any[]) {
    if (this.config.level <= LogLevel.WARN) {
      console.warn(this.format("WARN", "yellow", ...args));
    }
  }

  error(...args: any[]) {
    if (this.config.level <= LogLevel.ERROR) {
      console.error(this.format("ERROR", "red", ...args));
    }
  }

  state(name: string, value: any) {
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
