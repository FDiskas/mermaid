import { useCallback, useEffect, useRef } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";

export interface Snapshot {
  id: string;
  time: number;
  code: string;
}

const MAX_SNAPSHOTS = 40;
const IDLE_MS = 3000;

/** Saves a version of the code after it has been left alone for a few seconds. */
export function useSnapshots(code: string) {
  const [snapshots, setSnapshots] = usePersistentState<Snapshot[]>("history", []);
  const latest = useRef(snapshots);
  latest.current = snapshots;

  useEffect(() => {
    if (code.trim() === "") return;
    const timer = setTimeout(() => {
      if (latest.current[0]?.code === code) return;
      const next: Snapshot = { id: crypto.randomUUID(), time: Date.now(), code };
      setSnapshots([next, ...latest.current].slice(0, MAX_SNAPSHOTS));
    }, IDLE_MS);
    return () => clearTimeout(timer);
  }, [code, setSnapshots]);

  const remove = useCallback((id: string) => setSnapshots((all) => all.filter((s) => s.id !== id)), [setSnapshots]);
  const clearAll = useCallback(() => setSnapshots([]), [setSnapshots]);
  return { snapshots, remove, clearAll };
}
