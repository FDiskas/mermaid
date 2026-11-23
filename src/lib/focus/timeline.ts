import { findHeaderLine } from "@/lib/diagram-type";
import { EXTRA_LINE, SECTION_LINE, TITLE_LINE, decodeText, splitEvents } from "@/lib/timeline";
import { norm } from "./dom";
import { squash } from "./squash";
import type { FocusAdapter, FocusItem } from "./types";

type Kind = "title" | "section" | "period" | "event";

/** Keys of the items. The panel rows use them too. Indexes count from 0 in the model: section, period in its section, event in its period. */
export const TIMELINE_TITLE_KEY = "title";
export const timelineSectionKey = (section: number): string => `section:${section}`;
export const timelinePeriodKey = (section: number, period: number): string => `period:${section}.${period}`;
export const timelineEventKey = (section: number, period: number, event: number): string => `event:${section}.${period}.${event}`;

/** The elements that draw each kind of item, in the order of the code. */
const DRAWN: Record<Kind, (root: SVGSVGElement) => Element[]> = {
  title: (root) => [...root.querySelectorAll(":scope > text")],
  // A section title is a node of its own: a group without a class that sits right under the SVG.
  section: (root) => [...root.querySelectorAll(":scope > g:not([class])")].filter((group) => group.querySelector(":scope > g.timeline-node")),
  period: (root) => [...root.querySelectorAll("g.taskWrapper")],
  event: (root) => [...root.querySelectorAll("g.eventWrapper")],
};

const KINDS = Object.keys(DRAWN) as Kind[];

/** Reads the lines like `parseTimeline` does, so the keys are the same as the ones the panel builds from the model. */
export const timelineFocus: FocusAdapter = {
  items(code) {
    const lines = code.split(/\r?\n/);
    const header = findHeaderLine(lines);
    if (header === -1 || !/^\s*timeline\b/.test(lines[header] ?? "")) return [];

    const items: FocusItem[] = [];
    const add = (key: string, kind: Kind, line: number, text: string) => items.push({ key, kind, from: line, to: line, text: norm(text) });
    let section = -1;
    let periods = 0;
    let events = 0;
    let hasPeriod = false;

    lines.forEach((raw, index) => {
      const line = raw.trim();
      if (index <= header || line === "") return;
      const sectionLine = SECTION_LINE.exec(line);
      const titleLine = TITLE_LINE.exec(line);
      if (sectionLine) {
        section += 1;
        periods = 0;
        hasPeriod = false;
        add(timelineSectionKey(section), "section", index, decodeText((sectionLine[1] ?? "").trim()));
      } else if (titleLine) {
        add(TIMELINE_TITLE_KEY, "title", index, (titleLine[1] ?? "").trim());
      } else if (EXTRA_LINE.test(line)) {
        return;
      } else if (line.startsWith(":") && hasPeriod) {
        for (const event of splitEvents(line.slice(1))) add(timelineEventKey(section, periods - 1, events++), "event", index, event);
      } else if (!line.startsWith(":")) {
        // Periods before the first `section` line belong to a section without a title.
        if (section === -1) section = 0;
        const [label = "", ...texts] = line.split(":");
        events = 0;
        hasPeriod = true;
        add(timelinePeriodKey(section, periods++), "period", index, decodeText(label.trim()));
        for (const event of texts.flatMap((text) => splitEvents(text))) add(timelineEventKey(section, periods - 1, events++), "event", index, event);
      }
    });
    return items;
  },

  locate(root, items, key) {
    const item = items.find((candidate) => candidate.key === key);
    if (!item) return [];
    const kind = item.kind as Kind;
    // Items are drawn in the order of the code: the n-th item with a text is the n-th drawn element with that text.
    const rank = items.filter((other) => other.kind === kind && other.text === item.text).indexOf(item);
    const element = DRAWN[kind](root).filter((candidate) => squash(candidate.textContent) === squash(item.text))[rank];
    return element ? [element] : [];
  },

  pick(root, items, target) {
    for (const kind of KINDS) {
      const drawn = DRAWN[kind](root);
      const element = drawn.find((candidate) => candidate === target || candidate.contains(target));
      if (!element) continue;
      const text = squash(element.textContent);
      const rank = drawn.filter((candidate) => squash(candidate.textContent) === text).indexOf(element);
      return items.filter((item) => item.kind === kind && squash(item.text) === text)[rank]?.key ?? null;
    }
    return null;
  },
};
