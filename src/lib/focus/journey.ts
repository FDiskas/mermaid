import { findHeaderLine } from "@/lib/diagram-type";
import { parseJourney } from "@/lib/journey";
import { norm } from "./dom";
import type { FocusAdapter, FocusItem } from "./types";

type Kind = "task" | "section";

/** Key of the task at `index` among all tasks of the code. The panel rows use it too. */
export const journeyTaskKey = (index: number): string => `task:${index}`;
/** Key of the section at `index` in the model (an untitled first section counts, so the index is the model's). */
export const journeySectionKey = (index: number): string => `section:${index}`;

/** The item a code line stands for, read with the model's own parser so the two cannot disagree. `null` for other lines. */
function readLine(line: string): { kind: Kind; text: string } | null {
  const section = parseJourney(`journey\n${line}`)?.sections[0];
  if (!section) return null;
  if (section.title !== null) return { kind: "section", text: norm(section.title) };
  const task = section.tasks[0];
  return task ? { kind: "task", text: norm(task.name) } : null;
}

/** Mermaid draws a task as a `g` that holds a `line.task-line`, a `rect.task` and the face. */
const TASK_LINE = ":scope > line.task-line";
const SECTION_RECT = ":scope > rect.journey-section";

/** The `g` that draws the thing `target` belongs to (a face and a label sit in nested groups). */
function groupAt(target: Element, own: string): Element | null {
  for (let group = target.closest("g"); group; group = group.parentElement?.closest("g") ?? null) {
    if (group.querySelector(own)) return group;
  }
  return null;
}

/**
 * Mermaid draws a section only when it has tasks, so a section item is drawn when the next item is a task.
 * Tasks and sections are drawn in code order, so the n-th drawn one belongs to the n-th item of its kind.
 */
const drawnSections = (items: FocusItem[]): FocusItem[] => items.filter((item, index) => item.kind === "section" && items[index + 1]?.kind === "task");
const drawnItems = (items: FocusItem[], kind: Kind): FocusItem[] => (kind === "task" ? items.filter((item) => item.kind === "task") : drawnSections(items));

export const journeyFocus: FocusAdapter = {
  items(code) {
    if (!parseJourney(code)) return [];
    const lines = code.split(/\r?\n/);
    const header = findHeaderLine(lines);
    const items: FocusItem[] = [];
    let tasks = 0;
    // An untitled first section is made when a task comes before any `section` line.
    let sections = -1;
    lines.forEach((line, index) => {
      if (index <= header) return;
      const entry = readLine(line);
      if (!entry) return;
      if (entry.kind === "section") sections += 1;
      else if (sections === -1) sections = 0;
      const key = entry.kind === "section" ? journeySectionKey(sections) : journeyTaskKey(tasks++);
      items.push({ key, from: index, to: index, text: entry.text, kind: entry.kind });
    });
    return items;
  },

  locate(root, items, key) {
    const item = items.find((candidate) => candidate.key === key);
    if (!item) return [];
    const kind = item.kind as Kind;
    const rank = drawnItems(items, kind).indexOf(item);
    if (rank === -1) return [];
    if (kind === "section") return [...root.querySelectorAll("rect.journey-section")].slice(rank, rank + 1);
    const line = root.querySelectorAll("line.task-line")[rank];
    return [line?.parentElement?.querySelector(":scope > rect.task"), line].filter((element): element is Element => Boolean(element));
  },

  pick(root, items, target) {
    const task = groupAt(target, TASK_LINE);
    if (task) {
      const rank = [...root.querySelectorAll("line.task-line")].indexOf(task.querySelector(TASK_LINE) as Element);
      return drawnItems(items, "task")[rank]?.key ?? null;
    }
    const section = groupAt(target, SECTION_RECT);
    if (!section) return null;
    const rank = [...root.querySelectorAll("rect.journey-section")].indexOf(section.querySelector(SECTION_RECT) as Element);
    return drawnSections(items)[rank]?.key ?? null;
  },
};
