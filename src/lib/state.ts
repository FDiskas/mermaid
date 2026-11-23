import {
  EMPTY_TEXT,
  escapeText,
  hasStatementBreak,
  patchEntry,
  removeAt,
  joinDiagram,
  splitDiagram,
  swapNeighbour,
  topLevelIndent,
  uniqueName,
  withOrigin,
  writeWithOrigin,
  type EntryBase,
  type LineModel,
  type RawEntry,
} from "@/lib/line-model";

/** The start and end marker. */
export const TERMINAL_STATE = "[*]";

/** `from --> to : label` */
export interface Transition extends EntryBase {
  type: "transition";
  from: string;
  to: string;
  label: string;
}

/** `id : text`, or `state "text" as id` when `alias` is set. */
export interface StateText extends EntryBase {
  type: "text";
  id: string;
  text: string;
  alias: boolean;
}

export type StateEntry = Transition | StateText | RawEntry;
export type StateModel = LineModel<StateEntry>;
type EditableEntry = Transition | StateText;

const STATE_ID = String.raw`[^\s\-:{}<>\[\]"#;]+`;
const NODE = String.raw`(\[\*\]|${STATE_ID})`;
const TRANSITION = new RegExp(String.raw`^(\s*)${NODE}\s*-->\s*${NODE}\s*(?::\s*(.*))?$`);
const DESCRIPTION = new RegExp(String.raw`^(\s*)(${STATE_ID})\s*:(?!:)\s*(.*)$`);
const ALIAS = new RegExp(String.raw`^(\s*)state\s+"([^"]*)"\s+as\s+(${STATE_ID})\s*$`);
/** Words that open a line of their own (`title: x`) and are not a state. */
const NOT_A_STATE = new Set(["accTitle", "accDescr", "title", "direction", "note"]);

const isTerminal = (id: string) => id === TERMINAL_STATE;
/** Quotes cannot be written inside a quoted text. */
const quoteSafe = (text: string) => escapeText(text).replace(/"/g, "'");

function canonical(entry: EditableEntry): string {
  if (entry.type === "transition") {
    const label = escapeText(entry.label);
    return `${entry.indent}${entry.from} --> ${entry.to}${label ? `: ${label}` : ""}`;
  }
  return entry.alias ? `${entry.indent}state "${quoteSafe(entry.text) || EMPTY_TEXT}" as ${entry.id}` : `${entry.indent}${entry.id} : ${escapeText(entry.text) || EMPTY_TEXT}`;
}

function parseLine(line: string): StateEntry {
  const raw: RawEntry = { type: "raw", text: line };
  if (hasStatementBreak(line)) return raw;

  const transition = TRANSITION.exec(line);
  if (transition) {
    const [, indent = "", from = "", to = "", label = ""] = transition;
    return withOrigin({ type: "transition", from, to, label: label.trim(), indent }, line, canonical);
  }
  const alias = ALIAS.exec(line);
  if (alias) {
    const [, indent = "", text = "", id = ""] = alias;
    return withOrigin({ type: "text", id, text, alias: true, indent }, line, canonical);
  }
  const description = DESCRIPTION.exec(line);
  if (description && !NOT_A_STATE.has(description[2] ?? "")) {
    const [, indent = "", id = "", text = ""] = description;
    return withOrigin({ type: "text", id, text: text.trim(), alias: false, indent }, line, canonical);
  }
  return raw;
}

export function parseState(code: string): StateModel | null {
  const parts = splitDiagram(code, /^stateDiagram(-v2)?\b/);
  if (!parts) return null;
  return { prefix: parts.prefix, header: parts.header, entries: parts.body.map(parseLine) };
}

export function serializeState(model: StateModel): string {
  return joinDiagram(model, (entry) => (entry.type === "raw" ? entry.text : writeWithOrigin(entry, canonical)));
}

/** Ids of the states that appear in a transition or have a text, in order of appearance. The start and end marker is not one of them. */
export function stateIds(model: StateModel): string[] {
  const ids: string[] = [];
  const add = (id: string) => {
    if (!isTerminal(id) && !ids.includes(id)) ids.push(id);
  };
  for (const entry of model.entries) {
    if (entry.type === "transition") {
      add(entry.from);
      add(entry.to);
    } else if (entry.type === "text") add(entry.id);
  }
  return ids;
}

/** The text of a state, or `""` when it has none. */
export function stateText(model: StateModel, id: string): string {
  const entry = model.entries.find((candidate): candidate is StateText => candidate.type === "text" && candidate.id === id);
  return entry?.text ?? "";
}

/** Gives the state a text. An empty text removes a `id : text` line. A `state "…" as id` line stays, with the id as its text, because it also declares the state. */
export function setStateText(model: StateModel, id: string, text: string): StateModel {
  const index = model.entries.findIndex((entry) => entry.type === "text" && entry.id === id);
  const found = model.entries[index];
  if (found?.type === "text") {
    if (text.trim() === "" && !found.alias) return { ...model, entries: model.entries.filter((_, i) => i !== index) };
    const next = text.trim() === "" ? id : text;
    return { ...model, entries: model.entries.map((entry, i) => (i === index ? { ...found, text: next } : entry)) };
  }
  if (text.trim() === "") return model;
  const entry: StateText = { type: "text", id, text, alias: false, indent: topLevelIndent(model.entries) };
  return { ...model, entries: [...model.entries, entry] };
}

/** Adds a state with a text, because a state without a transition can only be declared that way. */
export function addState(model: StateModel, text: string): StateModel {
  const id = uniqueName("State", stateIds(model));
  const entry: StateText = { type: "text", id, text, alias: false, indent: topLevelIndent(model.entries) };
  return { ...model, entries: [...model.entries, entry] };
}

/** Removes the state, its text and every transition from or to it that the editor knows. */
export function removeState(model: StateModel, id: string): StateModel {
  const involved = (entry: StateEntry) => (entry.type === "transition" && (entry.from === id || entry.to === id)) || (entry.type === "text" && entry.id === id);
  return { ...model, entries: model.entries.filter((entry) => !involved(entry)) };
}

export function addTransition(model: StateModel): StateModel {
  const ids = stateIds(model);
  const [from = TERMINAL_STATE] = ids;
  const to = ids[1] ?? ids[0] ?? TERMINAL_STATE;
  const entry: Transition = { type: "transition", from, to, label: "", indent: topLevelIndent(model.entries) };
  return { ...model, entries: [...model.entries, entry] };
}

export const updateTransition = (model: StateModel, index: number, patch: Partial<Transition>): StateModel => patchEntry<StateEntry, StateModel>(model, index, "transition", patch);

export { removeAt as removeEntry };

/** A transition changes places with the next transition only. A line the editor does not know never moves. */
export function moveTransition(model: StateModel, index: number, step: -1 | 1): StateModel {
  const entries = swapNeighbour(model.entries, index, step, (a, b) => a.type === "transition" && b.type === "transition");
  return entries === model.entries ? model : { ...model, entries };
}

export function canMoveTransition(model: StateModel, index: number, step: -1 | 1): boolean {
  return moveTransition(model, index, step) !== model;
}
