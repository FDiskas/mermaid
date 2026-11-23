import { findHeaderLine } from "@/lib/diagram-type";
import { parseGantt } from "@/lib/gantt";
import { norm } from "./dom";
import type { FocusAdapter, FocusItem } from "./types";

type Kind = "task" | "section";

/** Key of the task at `index` among all tasks of the code. The panel rows use it too. */
export const ganttTaskKey = (index: number): string => `task:${index}`;
/** Key of the section at `index` in the model (an untitled first section counts, so the index is the model's). */
export const ganttSectionKey = (index: number): string => `section:${index}`;

/** What Mermaid gives a task that has no id of its own. */
const autoId = (count: number): string => `task${count}`;

/**
 * Mermaid draws the tasks sorted by their dates, not in code order, so a task is found by the id of its bar.
 * The id is the one written in the code, or `task1`, `task2`, … for the tasks without one (counted in code order).
 */
const drawnIds = new WeakMap<FocusItem, string>();

/** The item a code line stands for, read with the model's own parser so the two cannot disagree. `null` for other lines. */
function readLine(line: string): { kind: Kind; text: string; id: string } | null {
  const section = parseGantt(`gantt\n${line}`)?.sections[0];
  if (!section) return null;
  if (section.title !== null) return { kind: "section", text: norm(section.title), id: "" };
  const task = section.tasks[0];
  return task ? { kind: "task", text: norm(task.name), id: task.id } : null;
}

/** Mermaid names the elements of a task `<svg id>-<task id>` (bar) and `<svg id>-<task id>-text` (label). */
const barId = (root: SVGSVGElement, item: FocusItem): string => `${root.id}-${drawnIds.get(item)}`;
const LABEL_SUFFIX = "-text";

const byId = (root: SVGSVGElement, selector: string, id: string): Element | undefined => [...root.querySelectorAll(selector)].find((element) => element.id === id);

/** The drawn id of the task `target` belongs to (its bar or its label), or `null`. */
function taskIdAt(root: SVGSVGElement, target: Element): string | null {
  const bar = target.closest("rect.task");
  const label = target.closest(`text[id$="${LABEL_SUFFIX}"]`);
  const id = bar ? bar.id : label ? label.id.slice(0, -LABEL_SUFFIX.length) : null;
  return id?.startsWith(`${root.id}-`) ? id.slice(root.id.length + 1) : null;
}

export const ganttFocus: FocusAdapter = {
  items(code) {
    if (!parseGantt(code)) return [];
    const lines = code.split(/\r?\n/);
    const header = findHeaderLine(lines);
    const items: FocusItem[] = [];
    let tasks = 0;
    let withoutId = 0;
    // An untitled first section is made when a task comes before any `section` line.
    let sections = -1;
    lines.forEach((line, index) => {
      if (index <= header) return;
      const entry = readLine(line);
      if (!entry) return;
      if (entry.kind === "section") sections += 1;
      else if (sections === -1) sections = 0;
      const key = entry.kind === "section" ? ganttSectionKey(sections) : ganttTaskKey(tasks++);
      const item: FocusItem = { key, from: index, to: index, text: entry.text, kind: entry.kind };
      if (entry.kind === "task") drawnIds.set(item, entry.id || autoId(++withoutId));
      items.push(item);
    });
    return items;
  },

  locate(root, items, key) {
    const item = items.find((candidate) => candidate.key === key);
    if (!item) return [];
    if (item.kind === "section") {
      // Mermaid merges sections with the same title, so the first one with this title is the drawn one.
      return [...root.querySelectorAll("text.sectionTitle")].filter((title) => norm(title.textContent) === item.text).slice(0, 1);
    }
    const bar = byId(root, "rect.task", barId(root, item));
    const label = byId(root, "text", `${barId(root, item)}${LABEL_SUFFIX}`);
    return [bar, label].filter((element): element is Element => Boolean(element));
  },

  pick(root, items, target) {
    const id = taskIdAt(root, target);
    if (id !== null) return items.find((item) => drawnIds.get(item) === id)?.key ?? null;
    const title = target.closest("text.sectionTitle");
    if (!title) return null;
    return items.find((item) => item.kind === "section" && item.text === norm(title.textContent))?.key ?? null;
  },
};
