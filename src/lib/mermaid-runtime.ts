import mermaid from "mermaid";

export type DiagramTheme = "default" | "dark" | "forest" | "neutral" | "base";

const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function configure(theme: DiagramTheme) {
  mermaid.initialize({
    startOnLoad: false,
    theme,
    // Pure SVG text (no <foreignObject>): the preview and the PNG export then look identical in every browser.
    htmlLabels: false,
    look: "classic",
    securityLevel: "strict",
    suppressErrorRendering: true,
    fontFamily: FONT,
    flowchart: { htmlLabels: false, useMaxWidth: false },
  } as Parameters<typeof mermaid.initialize>[0]);
}

// Mermaid keeps global state and a scratch DOM node, so calls must never overlap.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

export interface RenderedDiagram {
  /** Standalone SVG markup with explicit pixel `width` and `height`. */
  svg: string;
  width: number;
  height: number;
}

let counter = 0;

/** Gives the SVG an explicit pixel size (Mermaid emits `width="100%"`) so it can be scaled, panned and exported. */
export function normalizeSvg(markup: string): RenderedDiagram {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const root = doc.documentElement;
  const box = (root.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  const width = Math.ceil(box[2] || Number.parseFloat(root.getAttribute("width") ?? "") || 300);
  const height = Math.ceil(box[3] || Number.parseFloat(root.getAttribute("height") ?? "") || 150);
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  root.removeAttribute("style");
  if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return { svg: new XMLSerializer().serializeToString(root), width, height };
}

export function renderDiagram(code: string, theme: DiagramTheme): Promise<RenderedDiagram> {
  return enqueue(async () => {
    configure(theme);
    const id = `mmd-${++counter}`;
    try {
      const { svg } = await mermaid.render(id, code);
      return normalizeSvg(svg);
    } finally {
      document.getElementById(`d${id}`)?.remove();
    }
  });
}

/** Parsed diagram internals (the `db` differs per diagram type). Throws on a syntax error. */
export function getDiagram(code: string, theme: DiagramTheme = "default") {
  return enqueue(async () => {
    configure(theme);
    return mermaid.mermaidAPI.getDiagramFromText(code);
  });
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Pulls the 1-based line number out of a Mermaid parse error, when there is one. */
export function errorLine(message: string): number | undefined {
  const match = /line (\d+)/i.exec(message);
  return match ? Number(match[1]) : undefined;
}
