import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { flushLoggerWrites } from './logger';

const LOG_DIRECTORY = 'logs';
const DAILY_LOG_FILE_PATTERN = /^app-\d{4}-\d{2}-\d{2}\.log$/;

export interface LogExport {
  data: string;
  fileName: string;
  sourceFiles: string[];
}

const compareFileNames = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const isMissingLogDirectoryError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error ? error.code : undefined;
  if (code === 'OS-PLUG-FILE-0008') {
    return true;
  }

  const message = 'message' in error ? error.message : undefined;
  return typeof message === 'string' && /folder .*does not exist/i.test(message);
};

const getDailyLogFileNames = async (): Promise<string[]> => {
  try {
    const result = await Filesystem.readdir({
      path: LOG_DIRECTORY,
      directory: Directory.Data,
    });

    return result.files
      .filter((file) => file.type === 'file' && DAILY_LOG_FILE_PATTERN.test(file.name))
      .map((file) => file.name)
      .sort(compareFileNames);
  } catch (error) {
    if (isMissingLogDirectoryError(error)) {
      return [];
    }
    throw error;
  }
};

const ensureTrailingNewline = (data: string): string => data.endsWith('\n') ? data : `${data}\n`;

const createExportFileName = (timestamp: Date): string =>
  `teapp_logs_${timestamp.toISOString().replace(/[:.]/g, '-')}.jsonl`;

export const createLogExport = async (timestamp = new Date()): Promise<LogExport | null> => {
  await flushLoggerWrites();

  const sourceFiles = await getDailyLogFileNames();
  if (sourceFiles.length === 0) {
    return null;
  }

  const contents: string[] = [];
  for (const fileName of sourceFiles) {
    const result = await Filesystem.readFile({
      path: `${LOG_DIRECTORY}/${fileName}`,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });

    if (typeof result.data !== 'string') {
      throw new Error(`Log file ${fileName} did not contain UTF-8 text`);
    }

    if (result.data.length > 0) {
      contents.push(ensureTrailingNewline(result.data));
    }
  }

  if (contents.length === 0) {
    return null;
  }

  return {
    data: contents.join(''),
    fileName: createExportFileName(timestamp),
    sourceFiles,
  };
};
