export type Direction = "TB" | "LR" | "BT" | "RL";
export type Stroke = "normal" | "dotted" | "thick" | "invisible";
export type HeadMarker = "arrow" | "open" | "cross" | "circle";
export type TailMarker = "none" | "arrow" | "cross" | "circle";

/** Shapes the visual editor can write using the classic bracket syntax. */
export const CLASSIC_SHAPES = [
  "square",
  "round",
  "stadium",
  "subroutine",
  "cylinder",
  "circle",
  "doublecircle",
  "diamond",
  "hexagon",
  "odd",
  "trapezoid",
  "inv_trapezoid",
  "lean_right",
  "lean_left",
] as const;
export type ClassicShape = (typeof CLASSIC_SHAPES)[number];

export interface FlowNode {
  id: string;
  label: string;
  /** Label is written as a markdown string (`"`text`"`). */
  markdown: boolean;
  /** A classic shape, or any other Mermaid shape name (written with the `@{ shape: … }` syntax). */
  shape: string;
  /** Extra `@{ … }` properties (icons, images, sizes) that are kept untouched. */
  props: Record<string, string>;
  /** Inline `style` declarations, e.g. `fill:#f9f`. */
  styles: string[];
  classes: string[];
  link?: string;
  linkTarget?: string;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  stroke: Stroke;
  head: HeadMarker;
  tail: TailMarker;
  /** Extra length of the link (`--->` is 2). */
  length: number;
  /** Inline `linkStyle` declarations. */
  styles: string[];
}

export interface FlowGroup {
  id: string;
  title: string;
  /** Direct children: node ids and nested group ids. */
  children: string[];
  direction?: Direction;
  classes: string[];
}

export interface ClassDef {
  id: string;
  styles: string[];
}

export interface FlowModel {
  /** Everything before the `flowchart` keyword (front matter, directives, comments). */
  prefix: string;
  keyword: "flowchart" | "graph";
  direction: Direction;
  nodes: FlowNode[];
  edges: FlowEdge[];
  groups: FlowGroup[];
  classDefs: ClassDef[];
}

export type Selection = { kind: "node" | "edge" | "group"; id: string } | null;

export function isClassicShape(shape: string): shape is ClassicShape {
  return (CLASSIC_SHAPES as readonly string[]).includes(shape);
}

/** Labels use `<br/>` for line breaks in Mermaid; text fields use real newlines. */
export function labelToText(label: string): string {
  return label.replace(/<br\s*\/?>/gi, "\n");
}
