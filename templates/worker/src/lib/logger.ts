export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

export interface LoggerOptions {
  service: string;
  correlationId: string;
  /** Where a finished log line goes. Defaults to the Workers log stream. */
  sink?: (line: string) => void;
}

const REDACTED = "[REDACTED]";

/**
 * Field names whose values must never be logged (docs/SECURITY.md, Logging). Matching is on the
 * key, so callers still must not put secrets inside free-text messages.
 */
const SECRET_KEY =
  /pin|otp|token|secret|password|passcode|authorization|cookie|card|cvv|cvc|signature|pepper|apikey|api_key/i;

const MAX_DEPTH = 6;

function redact(value: unknown, depth: number): unknown {
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[TRUNCATED]";
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const out: LogFields = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = SECRET_KEY.test(key) ? REDACTED : redact(inner, depth + 1);
  }
  return out;
}

/** Structured JSON logs: one line per entry, always with service and correlationId. */
export function createLogger(options: LoggerOptions): Logger {
  const sink =
    options.sink ??
    ((line: string) => {
      // The one place that writes to the console; everything else goes through this logger.
      // eslint-disable-next-line no-console
      console.log(line);
    });

  const write = (level: LogLevel, message: string, fields?: LogFields): void => {
    const safeFields = fields === undefined ? {} : (redact(fields, 0) as LogFields);
    sink(
      JSON.stringify({
        ...safeFields,
        level,
        message,
        service: options.service,
        correlationId: options.correlationId,
        time: new Date().toISOString(),
      }),
    );
  };

  return {
    debug: (message, fields) => {
      write("debug", message, fields);
    },
    info: (message, fields) => {
      write("info", message, fields);
    },
    warn: (message, fields) => {
      write("warn", message, fields);
    },
    error: (message, fields) => {
      write("error", message, fields);
    },
  };
}
