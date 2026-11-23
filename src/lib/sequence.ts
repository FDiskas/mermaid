import {
  EMPTY_TEXT,
  escapeText,
  hasStatementBreak,
  afterLast,
  indentNear,
  insertAt,
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

export type ParticipantKind = "participant" | "actor";

/** Longest arrows first, so the pattern does not stop at a shorter one. */
export const SEQUENCE_ARROWS = ["-->>", "->>", "--x", "-x", "--)", "-)", "-->", "->"] as const;
export type SequenceArrow = (typeof SEQUENCE_ARROWS)[number];

export const NOTE_PLACEMENTS = ["over", "right of", "left of"] as const;
export type NotePlacement = (typeof NOTE_PLACEMENTS)[number];

export interface Participant extends EntryBase {
  type: "participant";
  kind: ParticipantKind;
  id: string;
  /** The text after `as`. Empty when the participant has no alias. */
  label: string;
}

export interface Message extends EntryBase {
  type: "message";
  from: string;
  arrow: SequenceArrow;
  /** `+` or `-` in front of the receiver (activate or deactivate it), or empty. */
  activation: "" | "+" | "-";
  to: string;
  text: string;
}

export interface Note extends EntryBase {
  type: "note";
  placement: NotePlacement;
  /** One participant, or two separated by a comma for `over`. */
  actors: string;
  text: string;
}

export type SequenceEntry = Participant | Message | Note | RawEntry;
export type SequenceModel = LineModel<SequenceEntry>;
type EditableEntry = Participant | Message | Note;

const ID = String.raw`[^\s\-+:;#"@]+`;
const PARTICIPANT = new RegExp(String.raw`^(\s*)(participant|actor)\s+(${ID})(?:\s+as\s+(.+?))?\s*$`);
const MESSAGE = new RegExp(String.raw`^(\s*)(${ID})\s*(-->>|->>|--x|-x|--\)|-\)|-->|->)\s*([+-]?)(${ID})\s*:\s*(.*)$`);
const NOTE = /^(\s*)note\s+(left of|right of|over)\s+([^:]+?)\s*:\s*(.*)$/i;

function canonical(entry: EditableEntry): string {
  switch (entry.type) {
    case "participant": {
      const label = escapeText(entry.label);
      return `${entry.indent}${entry.kind} ${entry.id}${label && label !== entry.id ? ` as ${label}` : ""}`;
    }
    case "message":
      return `${entry.indent}${entry.from}${entry.arrow}${entry.activation}${entry.to}: ${escapeText(entry.text) || EMPTY_TEXT}`;
    case "note":
      return `${entry.indent}Note ${entry.placement} ${entry.actors.replace(/\s+/g, "")}: ${escapeText(entry.text) || EMPTY_TEXT}`;
  }
}

function parseLine(line: string): SequenceEntry {
  const raw: RawEntry = { type: "raw", text: line };
  if (hasStatementBreak(line)) return raw;

  const participant = PARTICIPANT.exec(line);
  if (participant) {
    const [, indent = "", kind = "participant", id = "", label = ""] = participant;
    return withOrigin({ type: "participant", kind: kind as ParticipantKind, id, label: label.trim(), indent }, line, canonical);
  }
  const note = NOTE.exec(line);
  if (note) {
    const [, indent = "", placement = "over", actors = "", text = ""] = note;
    return withOrigin({ type: "note", placement: placement.toLowerCase() as NotePlacement, actors: actors.replace(/\s+/g, ""), text: text.trim(), indent }, line, canonical);
  }
  const message = MESSAGE.exec(line);
  if (message) {
    const [, indent = "", from = "", arrow = "->>", activation = "", to = "", text = ""] = message;
    return withOrigin({ type: "message", from, arrow: arrow as SequenceArrow, activation: activation as Message["activation"], to, text: text.trim(), indent }, line, canonical);
  }
  return raw;
}

export function parseSequence(code: string): SequenceModel | null {
  const parts = splitDiagram(code, /^sequenceDiagram\b/);
  if (!parts) return null;
  return { prefix: parts.prefix, header: parts.header, entries: parts.body.map(parseLine) };
}

export function serializeSequence(model: SequenceModel): string {
  return joinDiagram(model, (entry) => (entry.type === "raw" ? entry.text : writeWithOrigin(entry, canonical)));
}

const isEditable = (entry: SequenceEntry): entry is EditableEntry => entry.type !== "raw";
const isStep = (entry: SequenceEntry): entry is Message | Note => entry.type === "message" || entry.type === "note";

export function participantsOf(model: SequenceModel): Participant[] {
  return model.entries.filter((entry): entry is Participant => entry.type === "participant");
}

/** Ids of the participants, declared or only used in a message, in order of appearance. */
export function knownIds(model: SequenceModel): string[] {
  const ids: string[] = [];
  const add = (id: string) => {
    if (!ids.includes(id)) ids.push(id);
  };
  for (const entry of model.entries) {
    if (entry.type === "participant") add(entry.id);
    else if (entry.type === "message") {
      add(entry.from);
      add(entry.to);
    }
  }
  return ids;
}

const indentAt = (entries: SequenceEntry[], index: number) => indentNear(entries, index, (entry) => (isEditable(entry) ? entry.indent : undefined));

/** Changes the entry at `index`. A change of the kind of entry is not possible. */
export function updateEntry(model: SequenceModel, index: number, patch: Partial<Participant> | Partial<Message> | Partial<Note>): SequenceModel {
  return { ...model, entries: model.entries.map((entry, i) => (i === index && isEditable(entry) ? ({ ...entry, ...patch } as SequenceEntry) : entry)) };
}

export { removeAt as removeEntry };

/** Participants change places with participants and messages with notes. A line the editor does not know never moves. */
export function moveEntry(model: SequenceModel, index: number, step: -1 | 1): SequenceModel {
  const entries = swapNeighbour(model.entries, index, step, (a, b) => (a.type === "participant" && b.type === "participant") || (isStep(a) && isStep(b)));
  return entries === model.entries ? model : { ...model, entries };
}

export const canMove = (model: SequenceModel, index: number, step: -1 | 1): boolean => moveEntry(model, index, step) !== model;

/** Puts a new participant after the last one that is declared, or at the start. */
export function addParticipant(model: SequenceModel, kind: ParticipantKind = "participant"): SequenceModel {
  const id = uniqueName("A", knownIds(model));
  const { last, at } = afterLast(model.entries, "participant");
  return insertAt(model, at, { type: "participant", kind, id, label: "", indent: indentAt(model.entries, Math.max(last, 0)) } satisfies Participant);
}

/** Adds a message at the end. With fewer than two participants it also declares the missing ones. */
export function addMessage(model: SequenceModel, text: string): SequenceModel {
  let next = model;
  while (knownIds(next).length < 2) next = addParticipant(next);
  const [from = "", to = from] = knownIds(next);
  const message: Message = { type: "message", from, arrow: "->>", activation: "", to, text, indent: topLevelIndent(next.entries) };
  return { ...next, entries: [...next.entries, message] };
}

export function addNote(model: SequenceModel, text: string): SequenceModel {
  let next = model;
  if (knownIds(next).length === 0) next = addParticipant(next);
  const [actor = ""] = knownIds(next);
  const note: Note = { type: "note", placement: "over", actors: actor, text, indent: topLevelIndent(next.entries) };
  return { ...next, entries: [...next.entries, note] };
}
