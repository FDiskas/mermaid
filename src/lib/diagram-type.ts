export type DiagramKind =
  | "flowchart"
  | "sequence"
  | "class"
  | "state"
  | "er"
  | "gantt"
  | "pie"
  | "journey"
  | "git"
  | "mindmap"
  | "timeline"
  | "quadrant"
  | "other"
  | "empty";

const KEYWORDS: [RegExp, DiagramKind][] = [
  [/^(flowchart|graph)(-elk)?\b/, "flowchart"],
  [/^sequenceDiagram\b/, "sequence"],
  [/^classDiagram\b/, "class"],
  [/^stateDiagram\b/, "state"],
  [/^erDiagram\b/, "er"],
  [/^gantt\b/, "gantt"],
  [/^pie\b/, "pie"],
  [/^journey\b/, "journey"],
  [/^gitGraph\b/, "git"],
  [/^mindmap\b/, "mindmap"],
  [/^timeline\b/, "timeline"],
  [/^quadrantChart\b/, "quadrant"],
];

/** Index of the first line that holds the diagram keyword (after front matter, blank lines and `%%` comments). */
export function findHeaderLine(lines: string[]): number {
  let i = 0;
  if (lines[0]?.trim() === "---") {
    const close = lines.findIndex((line, idx) => idx > 0 && line.trim() === "---");
    if (close === -1) return -1;
    i = close + 1;
  }
  for (; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();
    if (line === "" || line.startsWith("%%")) continue;
    return i;
  }
  return -1;
}

export function detectDiagramKind(code: string): DiagramKind {
  const lines = code.split(/\r?\n/);
  const header = findHeaderLine(lines);
  if (header === -1) return "empty";
  const first = (lines[header] ?? "").trim();
  for (const [pattern, kind] of KEYWORDS) {
    if (pattern.test(first)) return kind;
  }
  return "other";
}
