import { LoggerClass } from "./utils";

declare global {
  var logger: LoggerClass;
  var Logger: typeof LoggerClass;
}

globalThis.logger = new LoggerClass();
globalThis.Logger = LoggerClass;
