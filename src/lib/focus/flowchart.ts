import type { FlowModel, Selection } from "@/lib/flowchart/model";
import { escapeRegExp } from "@/lib/line-model";

/**
 * Flowchart code has no line numbers in its model, so the lines of an element are found in the text:
 * a node is where its id is written, an arrow is where its two ends are written, a group is its `subgraph` line.
 */

const NOT_ABOUT_ELEMENTS = /^\s*(classDef|linkStyle|direction|%%)/;

const idPattern = (id: string): RegExp => new RegExp(`(^|[^\\w])${escapeRegExp(id)}($|[^\\w])`);
const mentions = (line: string, id: string): boolean => idPattern(id).test(line);
const mentionPosition = (line: string, id: string): number => line.search(idPattern(id));
const subgraphLine = (id: string): RegExp => new RegExp(`^\\s*subgraph\\s+${escapeRegExp(id)}(\\s|\\[|$)`);

/** The 0-based lines that show `selection` in `code`. */
export function flowchartLines(code: string, flow: FlowModel, selection: NonNullable<Selection>): number[] {
  const lines = code.split(/\r?\n/);
  const candidates = lines.flatMap((line, index) => (NOT_ABOUT_ELEMENTS.test(line) ? [] : [index]));

  if (selection.kind === "group") {
    const header = candidates.find((index) => subgraphLine(selection.id).test(lines[index] ?? ""));
    return header === undefined ? [] : [header];
  }
  if (selection.kind === "node") return candidates.filter((index) => mentions(lines[index] ?? "", selection.id));

  const edge = flow.edges.find((candidate) => candidate.id === selection.id);
  if (!edge) return [];
  // The lines that write both ends of an arrow, from first to last. The n-th arrow between these two nodes is on the n-th such line.
  const between = flow.edges.filter((other) => other.from === edge.from && other.to === edge.to);
  const written = candidates.filter((index) => {
    const line = lines[index] ?? "";
    const from = mentionPosition(line, edge.from);
    const to = mentionPosition(line.slice(Math.max(from, 0)), edge.to);
    return from !== -1 && to !== -1 && /-|=|\./.test(line);
  });
  const line = written[Math.min(between.indexOf(edge), written.length - 1)];
  return line === undefined ? [] : [line];
}

/** The element the cursor is on: the node whose id is under the cursor, otherwise the arrow written on the line. */
export function flowchartSelectionAt(code: string, flow: FlowModel, line: number, column: number): Selection {
  const text = code.split(/\r?\n/)[line] ?? "";
  if (NOT_ABOUT_ELEMENTS.test(text)) return null;
  const group = flow.groups.find((candidate) => subgraphLine(candidate.id).test(text));
  if (group) return { kind: "group", id: group.id };

  const word = [...text.matchAll(/[\w]+/g)].find((match) => column >= match.index && column <= match.index + match[0].length)?.[0];
  const node = flow.nodes.find((candidate) => candidate.id === word);
  if (node) return { kind: "node", id: node.id };

  const edge = flow.edges.find((candidate) => flowchartLines(code, flow, { kind: "edge", id: candidate.id }).includes(line));
  if (edge) return { kind: "edge", id: edge.id };
  const only = flow.nodes.filter((candidate) => mentions(text, candidate.id));
  return only.length === 1 ? { kind: "node", id: only[0]!.id } : null;
}
