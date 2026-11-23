import type { FocusAdapter, FocusItem } from "./types";

/**
 * Focus for the diagram types that draw named boxes joined by lines (class, ER).
 * A box item has the name in `text`. A line item has `pairText(from, to)` in `text`.
 */

const PAIR_SEPARATOR = "\t";

export const pairText = (from: string, to: string): string => `${from}${PAIR_SEPARATOR}${to}`;

const splitPair = (text: string): [string, string] => {
  const [from = "", to = ""] = text.split(PAIR_SEPARATOR);
  return [from, to];
};

/** How one diagram type draws its boxes and lines. */
export interface GraphSpec {
  /** `kind` of the items that are boxes, and of the items that are lines. */
  boxKind: string;
  lineKind: string;
  /** The elements that draw a box. */
  boxSelector: string;
  /** The name of the box that `element` draws, or `null`. */
  boxName(element: Element): string | null;
  /** The elements that draw a line. Each has a `data-id`. */
  linePathSelector: string;
  /** Matches the `data-id` of a line from `from` to `to`. */
  lineId(from: string, to: string): RegExp;
}

/** The `data-id` of the line. The label of the line carries the same id. */
const dataId = (element: Element): string => element.getAttribute("data-id") ?? "";

/** The path that draws the line `item`. The n-th line between a pair is drawn as the n-th path of that pair, in code order. */
function linePath(root: SVGSVGElement, spec: GraphSpec, items: FocusItem[], item: FocusItem): Element | undefined {
  const [from, to] = splitPair(item.text ?? "");
  const pattern = spec.lineId(from, to);
  const drawn = [...root.querySelectorAll(spec.linePathSelector)].filter((path) => pattern.test(dataId(path)));
  const rank = items.filter((other) => other.kind === spec.lineKind && other.text === item.text).indexOf(item);
  return drawn[rank];
}

/** The label of the line, when it has one. */
function lineLabel(root: SVGSVGElement, path: Element): Element | null {
  const label = [...root.querySelectorAll("g.edgeLabel [data-id]")].find((element) => dataId(element) === dataId(path));
  return label?.closest("g.edgeLabel") ?? label ?? null;
}

/** `locate` and `pick` for `spec`. The adapter gives `items`. */
export function graphFocus(spec: GraphSpec): Pick<FocusAdapter, "locate" | "pick"> {
  return {
    locate(root, items, key) {
      const item = items.find((candidate) => candidate.key === key);
      if (!item) return [];
      if (item.kind === spec.boxKind) {
        const box = [...root.querySelectorAll(spec.boxSelector)].find((element) => spec.boxName(element) === item.text);
        return box ? [box] : [];
      }
      const path = linePath(root, spec, items, item);
      if (!path) return [];
      const label = lineLabel(root, path);
      return label ? [path, label] : [path];
    },

    pick(root, items, target) {
      const box = target.closest(spec.boxSelector);
      if (box) {
        const name = spec.boxName(box);
        return items.find((item) => item.kind === spec.boxKind && item.text === name)?.key ?? null;
      }
      const path = target.closest(spec.linePathSelector) ?? target.closest("g.edgeLabel")?.querySelector("[data-id]");
      const id = path ? dataId(path) : "";
      if (!id) return null;
      const lines = items.filter((item) => item.kind === spec.lineKind);
      return lines.find((item) => {
        const drawn = linePath(root, spec, items, item);
        return drawn !== undefined && dataId(drawn) === id;
      })?.key ?? null;
    },
  };
}
