export function to128bitUUID(shortUUID: string): string {
  if (shortUUID.length === 4) {
    return `0000${shortUUID}-0000-1000-8000-00805f9b34fb`;
  }
  return shortUUID;
}
