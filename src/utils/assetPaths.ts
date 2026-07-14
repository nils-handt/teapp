export const getSqliteWasmPath = (baseUrl: string): string => {
  const normalizedBaseUrl = baseUrl === './' ? '' : baseUrl.replace(/\/$/, '');
  return `${normalizedBaseUrl}/assets`;
};
