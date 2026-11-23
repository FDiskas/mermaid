import { parseState, stateIds, type StateEntry } from "@/lib/state";
import { entryItems } from "./lines";
import type { FocusAdapter, FocusItem } from "./types";

const STATE_PREFIX = "state:";

/** Key of a state. The panel rows use it too. A transition is keyed by the index of its entry, like in the other line-based editors. */
export const stateKey = (id: string): string => `${STATE_PREFIX}${id}`;

/** `note right of A : text` is one line. `note right of A` opens a block that `end note` closes. Both draw one edge. */
const NOTE = /^\s*note\s+(?:left|right)\s+of\s+/i;
const NOTE_END = /^\s*end\s+note\s*$/i;
const COMMENT = /^\s*%%/;
const ARROW = /-->/g;

/** The code an entry was read from. */
const sourceOf = (entry: StateEntry): string => (entry.type === "raw" ? entry.text : (entry.origin?.raw ?? ""));

/**
 * The name of the edge that Mermaid draws for each entry (`null` for entries that draw none or more than one).
 * Mermaid names the edges `edge0`, `edge1`, … in code order, and a note counts as an edge, so the lines the editor
 * does not understand have to be counted too. A line inside a note block is text: it never draws an edge.
 */
function edgeNames(entries: StateEntry[]): (string | null)[] {
  let inNote = false;
  let drawn = 0;
  return entries.map((entry) => {
    const line = sourceOf(entry);
    let count = 0;
    if (inNote) inNote = !NOTE_END.test(line);
    else if (NOTE.test(line)) {
      inNote = !line.includes(":");
      count = 1;
    } else if (!COMMENT.test(line)) count = entry.type === "transition" ? 1 : entry.type === "raw" ? (line.match(ARROW)?.length ?? 0) : 0;
    drawn += count;
    return count === 1 ? `edge${drawn - 1}` : null;
  });
}

/** The state an SVG node or cluster draws: its id is `<svg id>-state-<state id>-<counter>`. Notes and the start and end marker draw no state. */
function stateOf(element: Element): string | null {
  if (element.classList.contains("statediagram-note")) return null;
  return /-state-(.+)-\d+$/.exec(element.id)?.[1] ?? null;
}

/** A state is a node. A state with states inside is a cluster. */
const stateElements = (root: SVGSVGElement): Element[] => [...root.querySelectorAll("g.node, g.statediagram-cluster")];

const edgeIndex = (edge: Element | null): string | null => /(edge\d+)$/.exec(edge?.id ?? "")?.[1] ?? null;

export const stateFocus: FocusAdapter = {
  items(code) {
    const model = parseState(code);
    if (!model) return [];
    const edges = edgeNames(model.entries);
    const keyOf = (entry: StateEntry, index: number): string | null => {
      if (entry.type === "transition") return String(index);
      // A state can have several text entries. The panel edits the first one.
      const isFirstText = entry.type === "text" && model.entries.findIndex((other) => other.type === "text" && other.id === entry.id) === index;
      return entry.type === "text" && isFirstText ? stateKey(entry.id) : null;
    };
    const items = entryItems(code, model.entries, sourceOf, keyOf).map((item): FocusItem => {
      if (item.key.startsWith(STATE_PREFIX)) return { ...item, kind: "state", text: item.key.slice(STATE_PREFIX.length) };
      const edge = edges[Number(item.key)];
      return { ...item, kind: "transition", ...(edge ? { text: edge } : {}) };
    });
    // A state that only appears in transitions has no line of its own. It points at the first line that names it.
    for (const id of stateIds(model)) {
      if (items.some((item) => item.key === stateKey(id))) continue;
      const first = model.entries.findIndex((entry) => entry.type === "transition" && (entry.from === id || entry.to === id));
      const line = items.find((item) => item.key === String(first));
      if (line) items.push({ key: stateKey(id), from: line.from, to: line.to, kind: "state", text: id });
    }
    return items;
  },

  locate(root, items, key) {
    const item = items.find((candidate) => candidate.key === key);
    if (!item?.text) return [];
    if (item.kind === "state") return stateElements(root).filter((element) => stateOf(element) === item.text);
    const path = root.querySelector(`path.transition[id$="-${item.text}"]`);
    const label = root.querySelector(`g.edgeLabels g.label[data-id="${item.text}"]`)?.closest("g.edgeLabel");
    return [path, label].filter((element): element is Element => Boolean(element));
  },

  pick(root, items, target) {
    const node = target.closest("g.node, g.statediagram-cluster");
    if (node) {
      const id = stateOf(node);
      return items.find((item) => item.kind === "state" && item.text === id)?.key ?? null;
    }
    const edge = edgeIndex(target.closest("path.transition")) ?? target.closest("g.edgeLabel")?.querySelector("g.label")?.getAttribute("data-id") ?? null;
    return items.find((item) => item.kind === "transition" && item.text === edge)?.key ?? null;
  },
};
