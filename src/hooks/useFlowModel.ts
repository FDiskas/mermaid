import { useEffect, useState } from "react";
import { parseFlowchart } from "@/lib/flowchart/parse";
import type { FlowModel } from "@/lib/flowchart/model";

/**
 * The editable model of a flowchart, re-read from `code` whenever it changes.
 * `setModel` lets an edit show up at once, before the re-read confirms it.
 */
export function useFlowModel(code: string, enabled: boolean) {
  const [model, setModel] = useState<FlowModel | null>(null);

  useEffect(() => {
    if (!enabled) {
      setModel(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const parsed = await parseFlowchart(code);
      if (!cancelled) setModel(parsed);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, enabled]);

  return [model, setModel] as const;
}
