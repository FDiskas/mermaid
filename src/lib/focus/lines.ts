import { findHeaderLine } from "@/lib/diagram-type";
import type { FocusItem } from "./types";

/**
 * The source lines of the entries of a line-based model. `sourceOf` gives the code an entry was read from
 * (an entry may span several lines). `keyOf` returns `null` for entries that cannot be focused (raw lines).
 */
export function entryItems<Entry>(code: string, entries: Entry[], sourceOf: (entry: Entry) => string, keyOf: (entry: Entry, index: number) => string | null): FocusItem[] {
  const header = findHeaderLine(code.split(/\r?\n/));
  if (header === -1) return [];
  const items: FocusItem[] = [];
  let line = header + 1;
  entries.forEach((entry, index) => {
    const from = line;
    line += sourceOf(entry).split("\n").length;
    const key = keyOf(entry, index);
    if (key !== null) items.push({ key, from, to: line - 1 });
  });
  return items;
}

export function itemAtLine(items: FocusItem[], line: number): FocusItem | undefined {
  return items.find((item) => line >= item.from && line <= item.to);
}

export function itemByKey(items: FocusItem[], key: string | null): FocusItem | undefined {
  return key === null ? undefined : items.find((item) => item.key === key);
}
