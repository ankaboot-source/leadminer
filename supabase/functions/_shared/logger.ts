/**
 * Structured logger for Supabase Edge Functions
 *
 * Deno best practices:
 * - Output structured JSON for log aggregators (CloudWatch, Datadog, etc.)
 * - Use LOG_LEVEL environment variable to control verbosity
 * - Consistent ISO 8601 timestamps (UTC)
 * - English only for developer/operator logs
 * - Include service name for tracing
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getLogLevel(): LogLevel {
  const envLevel = Deno.env.get("LOG_LEVEL")?.toLowerCase() as LogLevel;
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel;
  }
  // Default to info in production, debug in development
  return Deno.env.get("DENO_ENV") === "development" ? "debug" : "info";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getLogLevel()];
}

export function createLogger(service: string) {
  function log(level: LogLevel, message: string, context?: LogContext): void {
    if (!shouldLog(level)) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      service,
      level,
      message,
      ...context,
    };

    const output = JSON.stringify(entry);

    switch (level) {
      case "error":
        console.error(output);
        break;
      case "warn":
        console.warn(output);
        break;
      case "debug":
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  }

  return {
    debug: (message: string, context?: LogContext) =>
      log("debug", message, context),
    info: (message: string, context?: LogContext) =>
      log("info", message, context),
    warn: (message: string, context?: LogContext) =>
      log("warn", message, context),
    error: (message: string, context?: LogContext) =>
      log("error", message, context),
  };
}

export type Logger = ReturnType<typeof createLogger>;

// Default logger instance for simple imports
const defaultLogger = createLogger("edge-function");
export default defaultLogger;
