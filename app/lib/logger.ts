/**
 * Centralized logging utility
 * Provides consistent logging format across the application
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  module?: string;
  action?: string;
  userId?: string;
  correlationId?: string;
  [key: string]: any;
}

class Logger {
  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}]${context?.module ? ` [${context.module}]` : ""} ${message}${contextStr}`;
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage("info", message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage("warn", message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const fullContext = { ...context, error: errorMessage, stack: errorStack };
    console.error(this.formatMessage("error", message, fullContext));
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === "development") {
      console.debug(this.formatMessage("debug", message, context));
    }
  }
}

export const logger = new Logger();

/**
 * Create a scoped logger for a specific module
 */
export function createLogger(module: string) {
  return {
    info: (message: string, context?: Omit<LogContext, "module">) =>
      logger.info(message, { ...context, module }),
    warn: (message: string, context?: Omit<LogContext, "module">) =>
      logger.warn(message, { ...context, module }),
    error: (
      message: string,
      error?: Error | unknown,
      context?: Omit<LogContext, "module">,
    ) => logger.error(message, error, { ...context, module }),
    debug: (message: string, context?: Omit<LogContext, "module">) =>
      logger.debug(message, { ...context, module }),
  };
}
