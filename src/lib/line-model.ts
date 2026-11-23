import { findHeaderLine } from "@/lib/diagram-type";

/**
 * Shared base of the line-based editors (sequence, class, state, ER, git).
 *
 * These diagram types have a large syntax (blocks, notes, styles, directives). The editors understand only
 * the lines they can edit safely. Every other line is kept as a `raw` entry, in its place and unchanged.
 * A line the editor understood is written back exactly as it was, until the user changes it.
 */

export const INDENT = "    ";
/** Written in place of an empty text, so the line keeps its meaning when the code is parsed again. */
export const EMPTY_TEXT = "…";

export interface RawEntry {
  type: "raw";
  text: string;
}

/** What an editable entry looked like in the code, and what the editor wrote for it at that time. */
export interface Origin {
  raw: string;
  canonical: string;
}

export interface EntryBase {
  /** The whitespace in front of the line. A new entry copies it from its neighbour. */
  indent: string;
  origin?: Origin;
}

export interface LineModel<Entry> {
  /** Everything before the diagram keyword (front matter, directives, comments). */
  prefix: string;
  /** The line with the diagram keyword, as it was written (`stateDiagram-v2`, `gitGraph LR:`, …). */
  header: string;
  entries: Entry[];
}

/** Splits `code` at the line with the diagram keyword. Gives `null` when the code is another diagram type. */
export function splitDiagram(code: string, keyword: RegExp): { prefix: string; header: string; body: string[] } | null {
  const lines = code.split(/\r?\n/);
  const headerIndex = findHeaderLine(lines);
  if (headerIndex === -1 || !keyword.test((lines[headerIndex] ?? "").trim())) return null;
  const body = lines.slice(headerIndex + 1);
  while (body.length > 0 && (body.at(-1) ?? "").trim() === "") body.pop();
  return { prefix: lines.slice(0, headerIndex).join("\n"), header: lines[headerIndex] ?? "", body };
}

export function joinDiagram<Entry>(model: LineModel<Entry>, writeEntry: (entry: Entry) => string): string {
  const prefix = model.prefix ? model.prefix.replace(/\s*$/, "\n") : "";
  return [prefix + model.header, ...model.entries.map(writeEntry)].join("\n") + "\n";
}

export const leadingSpace = (line: string): string => /^\s*/.exec(line)?.[0] ?? "";

/** Marks a parsed entry with the line it came from. `canonical` is the text the editor writes for the entry as it is now. */
export function withOrigin<Entry extends EntryBase>(entry: Entry, raw: string, canonical: (entry: Entry) => string): Entry {
  return { ...entry, origin: { raw, canonical: canonical(entry) } };
}

/** The original lines while the entry is unchanged, otherwise the text the editor writes. */
export function writeWithOrigin<Entry extends EntryBase>(entry: Entry, canonical: (entry: Entry) => string): string {
  const text = canonical(entry);
  return entry.origin && entry.origin.canonical === text ? entry.origin.raw : text;
}

/** A line with a `;` is two statements for Mermaid. The editors leave such lines alone. */
export const hasStatementBreak = (line: string): boolean => line.includes(";");

/** Mermaid reads `#59;` as `;`. Used for the texts the user types. */
export const escapeText = (text: string): string => text.replace(/[\r\n]+/g, " ").replace(/;/g, "#59;").trim();

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when `word` stands as a whole word in `text`. */
export function mentions(text: string, word: string): boolean {
  return new RegExp(`(^|[^\\w])${escapeRegExp(word)}($|[^\\w])`).test(text);
}

/** `base`, or `base2`, `base3`, … when the name is taken. */
export function uniqueName(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base}${counter}`)) counter++;
  return `${base}${counter}`;
}

/** The indent of the entry nearest to `index` that has one (the next entry first, then the previous one). */
export function indentNear<Entry>(entries: Entry[], index: number, indentOf: (entry: Entry) => string | undefined): string {
  for (let i = index; i < entries.length; i++) {
    const indent = indentOf(entries[i] as Entry);
    if (indent !== undefined) return indent;
  }
  for (let i = Math.min(index, entries.length) - 1; i >= 0; i--) {
    const indent = indentOf(entries[i] as Entry);
    if (indent !== undefined) return indent;
  }
  return INDENT;
}

/** The smallest indent in the body: where a line that is added at the end belongs, outside any block. */
export function topLevelIndent(entries: ReadonlyArray<RawEntry | (EntryBase & { type: string })>): string {
  const indents = entries.flatMap((entry) => {
    if (entry.type !== "raw") return [(entry as EntryBase).indent];
    const { text } = entry as RawEntry;
    return text.trim() === "" ? [] : [leadingSpace(text)];
  });
  return indents.reduce((shallowest, indent) => (indent.length < shallowest.length ? indent : shallowest), indents[0] ?? INDENT);
}

/** A copy of `items` where the element at `from` and its neighbour in direction `step` change places. */
export function swapNeighbour<Item>(items: Item[], from: number, step: -1 | 1, canSwap: (a: Item, b: Item) => boolean): Item[] {
  const to = from + step;
  const a = items[from];
  const b = items[to];
  if (a === undefined || b === undefined || !canSwap(a, b)) return items;
  const next = items.slice();
  next[from] = b;
  next[to] = a;
  return next;
}

interface HasEntries<Entry> {
  entries: Entry[];
}

export function removeAt<Model extends HasEntries<unknown>>(model: Model, index: number): Model {
  return { ...model, entries: model.entries.filter((_, i) => i !== index) };
}

export function insertAt<Model extends HasEntries<unknown>>(model: Model, at: number, entry: Model["entries"][number]): Model {
  return { ...model, entries: [...model.entries.slice(0, at), entry, ...model.entries.slice(at)] };
}

/** Changes the entry at `index`, but only when it has the given `type`. */
export function patchEntry<Entry extends { type: string }, Model extends HasEntries<Entry>>(model: Model, index: number, type: Entry["type"], patch: Partial<Entry>): Model {
  return { ...model, entries: model.entries.map((entry, i) => (i === index && entry.type === type ? { ...entry, ...patch } : entry)) };
}

/** An entry changes places with a neighbour of the same type. A raw line never moves. */
export function moveSameType<Model extends HasEntries<{ type: string }>>(model: Model, index: number, step: -1 | 1): Model {
  const entries = swapNeighbour(model.entries, index, step, (a, b) => a.type !== "raw" && a.type === b.type);
  return entries === model.entries ? model : { ...model, entries };
}

/**
 * True when no other entry mentions `name`: not a raw line, and not a typed entry that lists it in `referencesOf`.
 * Only then can the entry at `index` be renamed without leaving a dangling reference.
 */
export function isUnreferenced<Entry extends { type: string }>(entries: Entry[], index: number, name: string, referencesOf: (entry: Entry) => string[]): boolean {
  return entries.every((entry, i) => {
    if (i === index) return true;
    if (entry.type === "raw") return !mentions((entry as unknown as RawEntry).text, name);
    return !referencesOf(entry).includes(name);
  });
}

/** Index to insert after the last entry of `type`, or 0 when there is none. */
export function afterLast<Entry extends { type: string }>(entries: Entry[], type: string): { last: number; at: number } {
  const last = entries.findLastIndex((entry) => entry.type === type);
  return { last, at: last + 1 };
}
