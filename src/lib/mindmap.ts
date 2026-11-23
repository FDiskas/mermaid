import { findHeaderLine } from "@/lib/diagram-type";

export interface MindNode {
  /** The line as written, including a shape (`root((Idea))`, `id[Text]`). */
  text: string;
  /** Lines such as `::icon(fa fa-book)` or `:::urgent` that style this node. */
  decorations: string[];
  children: MindNode[];
}

export interface MindmapModel {
  /** Everything before the `mindmap` keyword (front matter, directives, comments). */
  prefix: string;
  /** Mermaid expects one root, but the parser keeps what it finds. */
  roots: MindNode[];
  /** Comment lines. Kept, but moved to the top. */
  extra: string[];
}

/** Position of a node: the index in `roots`, then the index in each `children` list. */
export type NodePath = number[];

const INDENT = "  ";
/** Written in place of an empty text, so the line keeps its meaning when the code is parsed again. */
const EMPTY_TEXT = "…";

export const newMindNode = (text: string): MindNode => ({ text, decorations: [], children: [] });

export function parseMindmap(code: string): MindmapModel | null {
  const lines = code.split(/\r?\n/);
  const header = findHeaderLine(lines);
  if (header === -1 || !/^\s*mindmap\b/.test(lines[header] ?? "")) return null;

  const model: MindmapModel = { prefix: lines.slice(0, header).join("\n"), roots: [], extra: [] };
  const stack: { indent: number; node: MindNode }[] = [];

  for (const raw of lines.slice(header + 1)) {
    const text = raw.trim();
    if (text === "") continue;
    if (text.startsWith("%%")) {
      model.extra.push(text);
      continue;
    }
    const last = stack.at(-1);
    if (text.startsWith("::") && last) {
      last.node.decorations.push(text);
      continue;
    }
    const indent = raw.length - raw.trimStart().length;
    while (stack.length > 0 && (stack.at(-1)?.indent ?? 0) >= indent) stack.pop();
    const node = newMindNode(text);
    (stack.at(-1)?.node.children ?? model.roots).push(node);
    stack.push({ indent, node });
  }
  return model;
}

function nodeLines(node: MindNode, depth: number): string[] {
  const indent = INDENT.repeat(depth + 1);
  return [
    `${indent}${node.text.trim() || EMPTY_TEXT}`,
    ...node.decorations.map((line) => `${indent}${line}`),
    ...node.children.flatMap((child) => nodeLines(child, depth + 1)),
  ];
}

export function serializeMindmap(model: MindmapModel): string {
  const lines = ["mindmap", ...model.extra.map((line) => `${INDENT}${line}`), ...model.roots.flatMap((root) => nodeLines(root, 0))];
  const text = lines.join("\n") + "\n";
  return model.prefix ? model.prefix.replace(/\s*$/, "\n") + text : text;
}

/** Replaces the node at `path` with `change(node)`. Returning `null` removes it. Other nodes are shared, not copied. */
export function changeNode(nodes: MindNode[], path: NodePath, change: (node: MindNode) => MindNode | null): MindNode[] {
  const [index, ...rest] = path;
  if (index === undefined) return nodes;
  return nodes.flatMap((node, i) => {
    if (i !== index) return [node];
    if (rest.length === 0) {
      const changed = change(node);
      return changed ? [changed] : [];
    }
    return [{ ...node, children: changeNode(node.children, rest, change) }];
  });
}
