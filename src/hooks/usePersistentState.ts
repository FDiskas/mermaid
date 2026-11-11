import { useCallback, useEffect, useRef, useState } from "react";
import { readStorage, writeStorage } from "@/lib/storage";

/** `useState` that is restored from and saved to localStorage under `key`. */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readStorage(key, initial));
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    writeStorage(key, value);
  }, [key, value]);

  const set = useCallback((next: T | ((prev: T) => T)) => setValue(next), []);
  return [value, set] as const;
}
