import {
  isClassicShape,
  type ClassicShape,
  type Direction,
  type FlowEdge,
  type FlowGroup,
  type FlowModel,
  type FlowNode,
} from "./model";

const BRACKETS: Record<ClassicShape, [string, string]> = {
  square: ["[", "]"],
  round: ["(", ")"],
  stadium: ["([", "])"],
  subroutine: ["[[", "]]"],
  cylinder: ["[(", ")]"],
  circle: ["((", "))"],
  doublecircle: ["(((", ")))"],
  diamond: ["{", "}"],
  hexagon: ["{{", "}}"],
  odd: [">", "]"],
  trapezoid: ["[/", "\\]"],
  inv_trapezoid: ["[\\", "/]"],
  lean_right: ["[/", "/]"],
  lean_left: ["[\\", "\\]"],
};

export function quote(text: string): string {
  return `"${text.replace(/"/g, "#quot;").replace(/\r?\n/g, "<br/>")}"`;
}

function nodeDeclaration(node: FlowNode): string {
  const extra = Object.entries(node.props).filter(([key]) => key !== "shape" && key !== "label");
  if (!isClassicShape(node.shape) || extra.length > 0) {
    const parts = [`shape: ${node.shape}`, `label: ${quote(node.label)}`, ...extra.map(([k, v]) => `${k}: ${quote(v)}`)];
    return `${node.id}@{ ${parts.join(", ")} }`;
  }
  if (node.shape === "square" && !node.markdown && node.label === node.id) return node.id;
  const [open, close] = BRACKETS[node.shape];
  const text = node.markdown ? `"\`${node.label}\`"` : quote(node.label);
  return `${node.id}${open}${text}${close}`;
}

const END_CHAR = { arrow: ">", open: "", cross: "x", circle: "o" } as const;
const TAIL_CHAR = { none: "", arrow: "<", cross: "x", circle: "o" } as const;

/** The link token between two nodes, e.g. `-->`, `-.->`, `==>`, `<-->`, `~~~`. */
export function linkToken(edge: Pick<FlowEdge, "stroke" | "head" | "tail" | "length">): string {
  if (edge.stroke === "invisible") return "~~~";
  const len = Math.max(1, edge.length);
  const head = edge.head === "open" && edge.tail !== "none" ? "arrow" : edge.head;
  const end = END_CHAR[head];
  const start = TAIL_CHAR[edge.tail];
  if (edge.stroke === "dotted") return `${start}-${".".repeat(len)}-${end}`;
  const line = edge.stroke === "thick" ? "=" : "-";
  const open = head === "open";
  return `${start}${line.repeat(len + (open ? 2 : 1))}${end}`;
}

function edgeLine(edge: FlowEdge): string {
  const text = edge.label ? `|${quote(edge.label)}|` : "";
  return `${edge.from} ${linkToken(edge)}${text} ${edge.to}`;
}

function groupBlock(group: FlowGroup, groups: Map<string, FlowGroup>, depth: number): string[] {
  const pad = "    ".repeat(depth);
  const lines = [`${pad}subgraph ${group.id}[${quote(group.title)}]`];
  if (group.direction) lines.push(`${pad}    direction ${group.direction}`);
  for (const child of group.children) {
    const nested = groups.get(child);
    if (nested) lines.push(...groupBlock(nested, groups, depth + 1));
    else lines.push(`${pad}    ${child}`);
  }
  lines.push(`${pad}end`);
  return lines;
}

function directionToken(direction: Direction): string {
  return direction === "TB" ? "TD" : direction;
}

/** Writes a model back as Mermaid flowchart source. Deterministic and idempotent. */
export function serializeFlowchart(model: FlowModel): string {
  const out: string[] = [];
  const indent = "    ";
  const groups = new Map(model.groups.map((g) => [g.id, g]));
  const nested = new Set(model.groups.flatMap((g) => g.children));

  out.push(`${model.keyword} ${directionToken(model.direction)}`);
  for (const node of model.nodes) out.push(indent + nodeDeclaration(node));
  for (const group of model.groups) {
    if (!nested.has(group.id)) out.push(...groupBlock(group, groups, 1));
  }
  for (const edge of model.edges) out.push(indent + edgeLine(edge));

  for (const def of model.classDefs) {
    if (def.styles.length) out.push(`${indent}classDef ${def.id} ${def.styles.join(",")}`);
  }
  const byClass = new Map<string, string[]>();
  for (const item of [...model.nodes, ...model.groups]) {
    for (const cls of item.classes) byClass.set(cls, [...(byClass.get(cls) ?? []), item.id]);
  }
  for (const [cls, ids] of byClass) out.push(`${indent}class ${ids.join(",")} ${cls}`);
  for (const node of model.nodes) {
    if (node.styles.length) out.push(`${indent}style ${node.id} ${node.styles.join(",")}`);
  }
  model.edges.forEach((edge, index) => {
    if (edge.styles.length) out.push(`${indent}linkStyle ${index} ${edge.styles.join(",")}`);
  });
  for (const node of model.nodes) {
    if (node.link) out.push(`${indent}click ${node.id} href ${quote(node.link)}${node.linkTarget ? ` ${node.linkTarget}` : ""}`);
  }

  const body = out.join("\n") + "\n";
  return model.prefix ? model.prefix.replace(/\s*$/, "\n") + body : body;
}
