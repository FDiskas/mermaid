import { findHeaderLine } from "@/lib/diagram-type";
import { AXIS, POINT, QUADRANT_NAME, TITLE_LINE, splitAxis } from "@/lib/quadrant";
import { norm } from "./dom";
import { squash } from "./squash";
import type { FocusAdapter, FocusItem } from "./types";

type Kind = "title" | "axis" | "quadrant" | "point";

/** The four ends of the axes. Mermaid draws their labels in this order, whatever the order in the code. */
export const AXIS_ENDS = ["xLeft", "xRight", "yBottom", "yTop"] as const;
export type AxisEnd = (typeof AXIS_ENDS)[number];

/** Keys of the items. The panel rows use them too. `quadrantKey` counts from 0 (quadrant-1 is 0). */
export const QUADRANT_TITLE_KEY = "title";
export const axisKey = (end: AxisEnd): string => `axis:${end}`;
export const quadrantKey = (index: number): string => `quadrant:${index}`;
export const pointKey = (index: number): string => `point:${index}`;

const AXIS_KEYS = AXIS_ENDS.map(axisKey);

/** Mermaid draws a point name without its `:::class` suffix and without quotes. */
const drawnName = (text: string): string => norm(text.replace(/:::\S*$/, "").replace(/^"(.*)"$/, "$1"));

const drawnPoints = (root: SVGSVGElement): Element[] => [...root.querySelectorAll("g.data-point")];
const drawnLabels = (root: SVGSVGElement): Element[] => [...root.querySelectorAll("g.labels > g.label")];
const drawnQuadrants = (root: SVGSVGElement): Element[] => [...root.querySelectorAll("g.quadrants > g.quadrant")];

const textOf = (element: Element): string => squash(element.textContent);

/** Mermaid draws the points in the reverse order of the code. */
const pointsDrawnAs = (root: SVGSVGElement, text: string): Element[] => drawnPoints(root).filter((element) => textOf(element) === squash(text)).reverse();

/** The axis items, in the order Mermaid draws their labels. */
const axisItems = (items: FocusItem[]): FocusItem[] => AXIS_KEYS.flatMap((key) => items.filter((item) => item.key === key));

/** Reads the lines like `parseQuadrant` does. A line that sets something twice (a second title) wins, as in the model. */
export const quadrantFocus: FocusAdapter = {
  items(code) {
    const lines = code.split(/\r?\n/);
    const header = findHeaderLine(lines);
    if (header === -1 || !/^\s*quadrantChart\b/.test(lines[header] ?? "")) return [];

    const single = new Map<string, FocusItem>();
    const points: FocusItem[] = [];
    const set = (key: string, kind: Kind, line: number, text: string) => single.set(key, { key, kind, from: line, to: line, text: norm(text.replace(/^"(.*)"$/, "$1")) });

    lines.forEach((raw, index) => {
      const line = raw.trim();
      if (index <= header || line === "") return;
      const title = TITLE_LINE.exec(line);
      const axis = AXIS.exec(line);
      const quadrant = QUADRANT_NAME.exec(line);
      const point = line.startsWith("%%") ? null : POINT.exec(line);
      if (title) {
        set(QUADRANT_TITLE_KEY, "title", index, title[1] ?? "");
      } else if (axis) {
        const [from, to] = splitAxis(axis[2] ?? "");
        const ends = axis[1] === "x-axis" ? (["xLeft", "xRight"] as const) : (["yBottom", "yTop"] as const);
        ends.forEach((end, position) => {
          const text = position === 0 ? from : to;
          if (text) set(axisKey(end), "axis", index, text);
          else single.delete(axisKey(end));
        });
      } else if (quadrant) {
        set(quadrantKey(Number(quadrant[1]) - 1), "quadrant", index, quadrant[2] ?? "");
      } else if (point) {
        points.push({ key: pointKey(points.length), kind: "point", from: index, to: index, text: drawnName(point[1] ?? "") });
      }
    });
    return [...single.values(), ...points].sort((a, b) => a.from - b.from);
  },

  locate(root, items, key) {
    const item = items.find((candidate) => candidate.key === key);
    if (!item) return [];
    const found = (element: Element | undefined): Element[] => (element ? [element] : []);
    switch (item.kind as Kind) {
      case "title":
        return found(root.querySelector("g.title") ?? undefined);
      case "axis":
        return found(drawnLabels(root)[axisItems(items).indexOf(item)]);
      case "quadrant":
        return found(drawnQuadrants(root)[Number(key.split(":")[1])]);
      case "point": {
        const rank = items.filter((other) => other.kind === "point" && other.text === item.text).indexOf(item);
        return found(pointsDrawnAs(root, item.text ?? "")[rank]);
      }
    }
  },

  pick(root, items, target) {
    if (target.closest("g.title")) return QUADRANT_TITLE_KEY;
    const label = target.closest("g.labels > g.label");
    if (label) return axisItems(items)[drawnLabels(root).indexOf(label)]?.key ?? null;
    const point = target.closest("g.data-point");
    if (point) {
      const text = textOf(point);
      const rank = pointsDrawnAs(root, text).indexOf(point);
      return items.filter((item) => item.kind === "point" && squash(item.text) === text)[rank]?.key ?? null;
    }
    const quadrant = target.closest("g.quadrants > g.quadrant");
    const key = quadrant ? quadrantKey(drawnQuadrants(root).indexOf(quadrant)) : null;
    return items.some((item) => item.key === key) ? key : null;
  },
};
