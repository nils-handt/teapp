import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export type LogLevel = typeof LOG_LEVELS[number];

export interface LoggerConfig {
  minLevel: LogLevel;
  enableFileLogging: boolean;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  scope: string;
  message: string;
  metadata: unknown[];
}

export interface AppLogger {
  debug: (message: string, ...metadata: unknown[]) => void;
  info: (message: string, ...metadata: unknown[]) => void;
  warn: (message: string, ...metadata: unknown[]) => void;
  error: (message: string, ...metadata: unknown[]) => void;
  log: (message: string, ...metadata: unknown[]) => void;
}

type LegacyLogCallback = (log: { level: string; message: string; optionalParams: unknown[] }) => void;

const LOG_LEVEL_PRIORITIES: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const FILE_LOG_DIRECTORY = 'logs';
const FILE_LOG_PREFIX = 'app';

export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  minLevel: 'debug',
  enableFileLogging: false,
};

let loggerConfig: LoggerConfig = { ...DEFAULT_LOGGER_CONFIG };
let loggingEnabled = true;
const logListeners = new Set<(entry: LogEntry) => void>();
let fileWriteQueue: Promise<void> = Promise.resolve();

export const isLogLevel = (value: unknown): value is LogLevel =>
  typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value);

export const getLoggerConfig = (): LoggerConfig => ({ ...loggerConfig });

export const configureLogger = (config: Partial<LoggerConfig>): void => {
  const nextConfig: LoggerConfig = { ...loggerConfig };

  if (config.minLevel && isLogLevel(config.minLevel)) {
    nextConfig.minLevel = config.minLevel;
  }

  if (typeof config.enableFileLogging === 'boolean') {
    nextConfig.enableFileLogging = config.enableFileLogging;
  }

  loggerConfig = nextConfig;
};

export const flushLoggerWrites = async (): Promise<void> => {
  await fileWriteQueue;
};

export const resetLoggerForTest = (): void => {
  loggerConfig = { ...DEFAULT_LOGGER_CONFIG };
  loggingEnabled = true;
  logListeners.clear();
  fileWriteQueue = Promise.resolve();
};

export const getLogFilePath = (timestamp: string): string =>
  `${FILE_LOG_DIRECTORY}/${FILE_LOG_PREFIX}-${timestamp.slice(0, 10)}.log`;

const serializeMetadataValue = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => serializeMetadataValue(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [key, serializeMetadataValue(nestedValue, seen)])
  );
};

const normalizeMetadata = (metadata: unknown[]): unknown[] => metadata.map((item) => serializeMetadataValue(item));

const shouldEmit = (level: LogLevel): boolean =>
  loggingEnabled && LOG_LEVEL_PRIORITIES[level] >= LOG_LEVEL_PRIORITIES[loggerConfig.minLevel];

const formatConsoleMessage = (entry: LogEntry): string =>
  `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.scope}] ${entry.message}`;

const notifyListeners = (entry: LogEntry): void => {
  for (const listener of logListeners) {
    try {
      listener(entry);
    } catch (error) {
      console.log('[LOGGER_LISTENER] Failed to notify listener', serializeMetadataValue(error));
    }
  }
};

const reportFileSinkFailure = (error: unknown): void => {
  console.log('[LOGGER_FILE_SINK] Failed to write log entry', serializeMetadataValue(error));
};

const appendLogEntryToFile = async (entry: LogEntry): Promise<void> => {
  const path = getLogFilePath(entry.timestamp);
  const line = `${JSON.stringify(entry)}\n`;

  await Filesystem.mkdir({
    path: FILE_LOG_DIRECTORY,
    directory: Directory.Data,
    recursive: true,
  });

  try {
    await Filesystem.appendFile({
      path,
      data: line,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  } catch {
    await Filesystem.writeFile({
      path,
      data: line,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  }
};

const emitLog = (scope: string, level: LogLevel, message: string, metadata: unknown[]): void => {
  if (!shouldEmit(level)) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    metadata: normalizeMetadata(metadata),
  };

  console.log(formatConsoleMessage(entry), ...entry.metadata);
  notifyListeners(entry);

  if (!loggerConfig.enableFileLogging) {
    return;
  }

  fileWriteQueue = fileWriteQueue
    .then(() => appendLogEntryToFile(entry))
    .catch((error) => {
      reportFileSinkFailure(error);
    });
};

export const createLogger = (scope: string): AppLogger => ({
  debug: (message: string, ...metadata: unknown[]) => emitLog(scope, 'debug', message, metadata),
  info: (message: string, ...metadata: unknown[]) => emitLog(scope, 'info', message, metadata),
  warn: (message: string, ...metadata: unknown[]) => emitLog(scope, 'warn', message, metadata),
  error: (message: string, ...metadata: unknown[]) => emitLog(scope, 'error', message, metadata),
  log: (message: string, ...metadata: unknown[]) => emitLog(scope, 'info', message, metadata),
});

export class Logger {
  private readonly appLogger: AppLogger;

  constructor(scope: string) {
    this.appLogger = createLogger(scope);
  }

  public static enableLog(): void {
    loggingEnabled = true;
  }

  public static disableLog(): void {
    loggingEnabled = false;
  }

  public static isLogEnabled(): boolean {
    return loggingEnabled;
  }

  public static attachOnLog(callback: LegacyLogCallback): void {
    logListeners.add((entry) => {
      callback({
        level: entry.level,
        message: `[${entry.scope}] ${entry.message}`,
        optionalParams: entry.metadata,
      });
    });
  }

  public debug(message: string, ...metadata: unknown[]): void {
    this.appLogger.debug(message, ...metadata);
  }

  public info(message: string, ...metadata: unknown[]): void {
    this.appLogger.info(message, ...metadata);
  }

  public warn(message: string, ...metadata: unknown[]): void {
    this.appLogger.warn(message, ...metadata);
  }

  public error(message: string, ...metadata: unknown[]): void {
    this.appLogger.error(message, ...metadata);
  }

  public log(message: string, ...metadata: unknown[]): void {
    this.appLogger.info(message, ...metadata);
  }
}
