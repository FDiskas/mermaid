import { findHeaderLine } from "@/lib/diagram-type";
import { SLICE } from "@/lib/pie";
import { norm } from "./dom";
import type { FocusAdapter, FocusItem } from "./types";

/** Key of the slice at `index` in the code. The panel rows use it too. */
export const sliceKey = (index: number): string => `slice:${index}`;

/** The legend shows `label` or, with `showData`, `label [value]`. */
const legendLabel = (text: string): string => norm(text).replace(/\s*\[[^\]]*\]$/, "");

/** Mermaid draws the slices and the legend from the biggest to the smallest, so the code order is not the drawing order. */
function legends(root: SVGSVGElement): { element: Element; label: string }[] {
  return [...root.querySelectorAll("g.legend")].map((element) => ({ element, label: legendLabel(element.textContent ?? "") }));
}

const sameLabelBefore = (labels: (string | undefined)[], index: number): number => labels.slice(0, index).filter((label) => label === labels[index]).length;

export const pieFocus: FocusAdapter = {
  items(code) {
    const lines = code.split(/\r?\n/);
    const header = findHeaderLine(lines);
    const items: FocusItem[] = [];
    lines.forEach((line, index) => {
      const slice = header !== -1 && index > header ? SLICE.exec(line) : null;
      if (slice) items.push({ key: sliceKey(items.length), from: index, to: index, text: legendLabel(slice[1] ?? slice[2] ?? "") });
    });
    return items;
  },

  locate(root, items, key) {
    const index = items.findIndex((item) => item.key === key);
    if (index === -1) return [];
    // The n-th legend with this label belongs to the n-th slice in the code with this label.
    const drawn = legends(root)
      .map((entry, position) => ({ ...entry, position }))
      .filter((entry) => entry.label === items[index]?.text)[sameLabelBefore(items.map((item) => item.text), index)]?.position;
    if (drawn === undefined) return [];
    return [legends(root)[drawn]?.element, root.querySelectorAll("path.pieCircle")[drawn], root.querySelectorAll("text.slice")[drawn]].filter((element): element is Element => Boolean(element));
  },

  pick(root, items, target) {
    const all = legends(root);
    const legend = target.closest("g.legend");
    let drawn = legend ? all.findIndex((entry) => entry.element === legend) : [...root.querySelectorAll("path.pieCircle")].indexOf(target);
    if (drawn === -1) drawn = [...root.querySelectorAll("text.slice")].indexOf(target);
    const label = all[drawn]?.label;
    if (label === undefined) return null;
    const rank = all.slice(0, drawn).filter((entry) => entry.label === label).length;
    return items.filter((item) => item.text === label)[rank]?.key ?? null;
  },
};
