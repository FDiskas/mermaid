import { findHeaderLine } from "@/lib/diagram-type";
import type { NodePath } from "@/lib/mindmap";
import { norm } from "./dom";
import { squash } from "./squash";
import type { FocusAdapter, FocusItem } from "./types";

/** Key of the node at `path` (see `NodePath`). The panel rows use it too. */
export const mindmapNodeKey = (path: NodePath): string => `node:${path.join(".")}`;

/** `id[text]`, `id(text)`, `id((text))`, `id))text((`, `id)text(`, `id{{text}}`: Mermaid draws only the text. */
const SHAPED_NODE = /^[^()[\]{}]*?(?:\(\(|\)\)|\{\{|[([)])(.*?)(?:\)\)|\(\(|\}\}|[)\](])\s*$/;

/** The text Mermaid draws for the node written as `line`. */
function drawnText(line: string): string {
  const text = (SHAPED_NODE.exec(line)?.[1] ?? line).trim();
  return norm(
    text
      .replace(/^"(.*)"$/, "$1")
      .replace(/^`(.*)`$/, "$1")
      .replace(/<br\s*\/?>/gi, " "),
  );
}

const drawnNodes = (root: SVGSVGElement): Element[] => [...root.querySelectorAll("g.mindmap-node")];

const nodesWithText = (nodes: Element[], text: string): Element[] => nodes.filter((node) => squash(node.textContent) === squash(text));

/** Reads the lines like `parseMindmap` does: the indent of a line says which node is its parent. */
export const mindmapFocus: FocusAdapter = {
  items(code) {
    const lines = code.split(/\r?\n/);
    const header = findHeaderLine(lines);
    if (header === -1 || !/^\s*mindmap\b/.test(lines[header] ?? "")) return [];

    const items: FocusItem[] = [];
    const stack: { indent: number; path: NodePath }[] = [];
    const childCount = new Map<string, number>();

    lines.forEach((raw, index) => {
      const text = raw.trim();
      if (index <= header || text === "" || text.startsWith("%%")) return;
      const last = items.at(-1);
      // A `::icon(…)` or `:::class` line belongs to the node before it.
      if (text.startsWith("::") && last) {
        last.to = index;
        return;
      }
      const indent = raw.length - raw.trimStart().length;
      while (stack.length > 0 && (stack.at(-1)?.indent ?? 0) >= indent) stack.pop();
      const parent = stack.at(-1)?.path ?? [];
      const position = childCount.get(parent.join(".")) ?? 0;
      childCount.set(parent.join("."), position + 1);
      const path = [...parent, position];
      stack.push({ indent, path });
      items.push({ key: mindmapNodeKey(path), from: index, to: index, text: drawnText(text) });
    });
    return items;
  },

  locate(root, items, key) {
    const item = items.find((candidate) => candidate.key === key);
    if (!item) return [];
    // Mermaid draws the nodes in the order of the code, so the n-th node with a text is the n-th drawn node with that text.
    const rank = items.filter((other) => other.text === item.text).indexOf(item);
    const node = nodesWithText(drawnNodes(root), item.text ?? "")[rank];
    return node ? [node] : [];
  },

  pick(root, items, target) {
    const node = target.closest("g.mindmap-node");
    if (!node) return null;
    const text = squash(node.textContent);
    const rank = nodesWithText(drawnNodes(root), text).indexOf(node);
    return items.filter((item) => squash(item.text) === text)[rank]?.key ?? null;
  },
};
