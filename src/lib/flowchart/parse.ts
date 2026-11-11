import { findHeaderLine } from "@/lib/diagram-type";
import { getDiagram } from "@/lib/mermaid-runtime";
import type { ClassDef, Direction, FlowEdge, FlowGroup, FlowModel, FlowNode, HeadMarker, Stroke } from "./model";
import { renumberEdges } from "./ops";

// Mermaid's flowchart db is untyped, hence the `any`s below.

function entries<T>(collection: unknown): [string, T][] {
  if (!collection) return [];
  if (collection instanceof Map) return [...collection.entries()] as [string, T][];
  return Object.entries(collection as Record<string, T>);
}

function toDirection(value: unknown): Direction {
  switch (String(value).toUpperCase()) {
    case "LR":
      return "LR";
    case "RL":
      return "RL";
    case "BT":
      return "BT";
    default:
      return "TB";
  }
}

/**
 * Mermaid hides `#name;` / `#123;` entities behind private markers while it parses.
 * Turn them back into text: `#quot;` becomes `"` (the serializer escapes it again), others stay as `#name;`.
 */
export function decodeEntities(text: string): string {
  return text
    .replace(/ﬂ°°(\d+)¶ß/g, "#$1;")
    .replace(/ﬂ°(\w+)¶ß/g, (_match, name: string) => (name === "quot" ? '"' : `#${name};`));
}

function toEdge(raw: any): FlowEdge {
  const type = String(raw.type ?? "arrow_point");
  const double = type.startsWith("double_");
  const base = type.replace("double_", "");
  const head: HeadMarker =
    base === "arrow_point" ? "arrow" : base === "arrow_cross" ? "cross" : base === "arrow_circle" ? "circle" : "open";
  return {
    id: String(raw.id ?? ""),
    from: String(raw.start),
    to: String(raw.end),
    label: decodeEntities(String(raw.text ?? "")),
    stroke: (raw.stroke ?? "normal") as Stroke,
    head,
    tail: double ? (head === "open" ? "arrow" : head) : "none",
    length: Number(raw.length ?? 1),
    // Mermaid appends `fill:none` itself when a link has a style.
    styles: ((raw.style ?? []) as string[]).filter((s) => s.replace(/\s/g, "") !== "fill:none"),
  };
}

/**
 * Reads flowchart source into an editable model using Mermaid's own parser,
 * so every syntax Mermaid accepts is understood. Returns null for non-flowcharts or syntax errors.
 */
export async function parseFlowchart(code: string): Promise<FlowModel | null> {
  const lines = code.split(/\r?\n/);
  const header = findHeaderLine(lines);
  if (header === -1) return null;
  const keyword = /^\s*(flowchart|graph)\b/.exec(lines[header] ?? "")?.[1];
  if (keyword !== "flowchart" && keyword !== "graph") return null;

  let db: any;
  try {
    db = (await getDiagram(code)).db;
  } catch {
    return null;
  }
  if (typeof db?.getVertices !== "function") return null;

  const nodes: FlowNode[] = entries<any>(db.getVertices()).map(([id, v]) => ({
    id,
    label: decodeEntities(String(v.text ?? id)),
    // A "markdown" label without any markdown characters is the same as a plain label.
    markdown: v.labelType === "markdown" && /[*_`]/.test(String(v.text ?? "")),
    shape: v.type ?? "square",
    props: Object.fromEntries(Object.entries(v.props ?? {}).map(([k, val]) => [k, String(val)])),
    styles: [...(v.styles ?? [])],
    classes: ((v.classes ?? []) as string[]).filter((c) => c !== "clickable"),
    link: v.link || undefined,
    linkTarget: v.linkTarget || undefined,
  }));

  const groups: FlowGroup[] = (db.getSubGraphs() as any[]).map((g) => ({
    id: String(g.id),
    title: decodeEntities(String(g.title ?? g.id)),
    children: [...(g.nodes ?? [])].map(String),
    direction: g.dir ? toDirection(g.dir) : undefined,
    classes: [...(g.classes ?? [])].filter((c: string) => c !== "default"),
  }));

  const classDefs: ClassDef[] = entries<any>(db.getClasses())
    .filter(([id]) => id !== "default")
    .map(([id, def]) => ({ id, styles: [...(def.styles ?? [])] }));

  return renumberEdges({
    prefix: lines.slice(0, header).join("\n"),
    keyword,
    direction: toDirection(db.getDirection()),
    nodes,
    edges: (db.getEdges() as any[]).map(toEdge),
    groups,
    classDefs,
  });
}
