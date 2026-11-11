/** Thin, failure-tolerant wrapper around localStorage. All app data lives here — there is no backend. */
const PREFIX = "mermaid-drawing:";

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked (private mode). The app keeps working in memory.
  }
}
