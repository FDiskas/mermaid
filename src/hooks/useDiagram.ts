import { useEffect, useState } from "react";
import { detectDiagramKind } from "@/lib/diagram-type";
import { errorLine, errorMessage, renderDiagram, type DiagramTheme, type RenderedDiagram } from "@/lib/mermaid-runtime";

export interface DiagramState {
  /** Last successful render. Kept on screen while the code has a syntax error. */
  rendered: RenderedDiagram | null;
  error: { message: string; line?: number } | null;
}

const RENDER_DELAY_MS = 200;

/** Renders `code` with Mermaid, debounced. */
export function useDiagram(code: string, theme: DiagramTheme): DiagramState {
  const [state, setState] = useState<DiagramState>({ rendered: null, error: null });

  useEffect(() => {
    let cancelled = false;
    if (detectDiagramKind(code) === "empty") {
      setState({ rendered: null, error: null });
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const rendered = await renderDiagram(code, theme);
        if (!cancelled) setState({ rendered, error: null });
      } catch (error) {
        if (cancelled) return;
        const message = errorMessage(error);
        setState((prev) => ({ rendered: prev.rendered, error: { message, line: errorLine(message) } }));
      }
    }, RENDER_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, theme]);

  return state;
}
