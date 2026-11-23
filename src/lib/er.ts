import {
  EMPTY_TEXT,
  escapeText,
  hasStatementBreak,
  afterLast,
  indentNear,
  insertAt,
  isUnreferenced,
  moveSameType,
  patchEntry,
  removeAt,
  joinDiagram,
  splitDiagram,
  topLevelIndent,
  uniqueName,
  withOrigin,
  writeWithOrigin,
  INDENT,
  type EntryBase,
  type LineModel,
  type RawEntry,
} from "@/lib/line-model";

/** Marks written at the left end of a relationship line: exactly one, zero or one, one or more, zero or more. */
export const LEFT_CARDINALITIES = ["||", "|o", "}|", "}o"] as const;
/** The same four, as they are written at the right end. */
export const RIGHT_CARDINALITIES = ["||", "o|", "|{", "o{"] as const;
export type LeftCardinality = (typeof LEFT_CARDINALITIES)[number];
export type RightCardinality = (typeof RIGHT_CARDINALITIES)[number];
/** `--` is an identifying relationship (solid line), `..` a non-identifying one (dashed line). */
export const RELATION_LINES = ["--", ".."] as const;
export type RelationLine = (typeof RELATION_LINES)[number];

export const ATTRIBUTE_KEYS = ["PK", "FK", "UK"] as const;

export interface Attribute {
  type: string;
  name: string;
  /** `PK`, `FK`, `UK`, in the order they were written. */
  keys: string[];
  comment: string;
}

export interface Entity extends EntryBase {
  type: "entity";
  name: string;
  attributes: Attribute[];
}

export interface Relationship extends EntryBase {
  type: "relationship";
  left: string;
  leftCardinality: LeftCardinality;
  line: RelationLine;
  rightCardinality: RightCardinality;
  right: string;
  label: string;
}

export type ErEntry = Entity | Relationship | RawEntry;
export type ErModel = LineModel<ErEntry>;
type EditableEntry = Entity | Relationship;

const NAME = String.raw`(?:"[^"]+"|[^\s"{}:;\[\]]+)`;
const left = LEFT_CARDINALITIES.map((mark) => mark.replace(/[|}]/g, "\\$&")).join("|");
const right = RIGHT_CARDINALITIES.map((mark) => mark.replace(/[|{]/g, "\\$&")).join("|");
const RELATIONSHIP = new RegExp(String.raw`^(\s*)(${NAME})\s+(${left})(--|\.\.)(${right})\s+(${NAME})\s*:\s*(.+?)\s*$`);
const ENTITY_OPEN = new RegExp(String.raw`^(\s*)(${NAME})\s*\{\s*$`);
const ATTRIBUTE = /^(\S+)\s+(\S+)((?:\s+(?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*)?)(?:\s+"([^"]*)")?$/;
const WORD_REPLACEMENT = "_";

const word = (text: string, fallback: string) => text.replace(/\s+/g, WORD_REPLACEMENT).replace(/["{};]/g, "") || fallback;

function writeAttribute(attribute: Attribute): string {
  const keys = attribute.keys.filter((key) => (ATTRIBUTE_KEYS as readonly string[]).includes(key));
  const comment = attribute.comment.replace(/"/g, "'").replace(/[\r\n;]+/g, " ").trim();
  return [word(attribute.type, "string"), word(attribute.name, "name"), keys.length > 0 ? keys.join(", ") : "", comment ? `"${comment}"` : ""].filter(Boolean).join(" ");
}

function canonical(entry: EditableEntry): string {
  if (entry.type === "relationship") {
    const label = escapeText(entry.label);
    return `${entry.indent}${entry.left} ${entry.leftCardinality}${entry.line}${entry.rightCardinality} ${entry.right} : ${/\s/.test(label) && !label.startsWith('"') ? `"${label.replace(/"/g, "'")}"` : label || EMPTY_TEXT}`;
  }
  const inner = entry.indent + INDENT;
  return [`${entry.indent}${entry.name} {`, ...entry.attributes.map((attribute) => inner + writeAttribute(attribute)), `${entry.indent}}`].join("\n");
}

function parseAttribute(line: string): Attribute | null {
  const match = ATTRIBUTE.exec(line.trim());
  if (!match) return null;
  const [, type = "", name = "", keys = "", comment = ""] = match;
  return { type, name, keys: keys.split(",").map((key) => key.trim()).filter(Boolean), comment };
}

function parseAt(lines: string[], index: number): { entry: ErEntry; length: number } {
  const line = lines[index] ?? "";
  const raw = (): { entry: ErEntry; length: number } => ({ entry: { type: "raw", text: line }, length: 1 });
  if (hasStatementBreak(line)) return raw();

  const open = ENTITY_OPEN.exec(line);
  if (open) {
    const end = lines.findIndex((candidate, i) => i > index && candidate.trim() === "}");
    const body = end === -1 ? [] : lines.slice(index + 1, end).filter((attribute) => attribute.trim() !== "");
    const attributes = body.map(parseAttribute);
    // One line that is not a plain attribute (a `{`, a stray `}`, odd syntax) and the whole block stays as it is.
    if (end === -1 || attributes.some((attribute) => attribute === null)) return raw();
    const source = lines.slice(index, end + 1).join("\n");
    const entity: Entity = { type: "entity", name: open[2] ?? "", attributes: attributes as Attribute[], indent: open[1] ?? "" };
    return { entry: withOrigin(entity, source, canonical), length: end - index + 1 };
  }
  const relationship = RELATIONSHIP.exec(line);
  if (relationship) {
    const [, indent = "", from = "", leftMark = "||", lineMark = "--", rightMark = "||", to = "", label = ""] = relationship;
    const entry: Relationship = {
      type: "relationship",
      left: from,
      leftCardinality: leftMark as LeftCardinality,
      line: lineMark as RelationLine,
      rightCardinality: rightMark as RightCardinality,
      right: to,
      label,
      indent,
    };
    return { entry: withOrigin(entry, line, canonical), length: 1 };
  }
  return raw();
}

export function parseEr(code: string): ErModel | null {
  const parts = splitDiagram(code, /^erDiagram\b/);
  if (!parts) return null;
  const entries: ErEntry[] = [];
  for (let index = 0; index < parts.body.length; ) {
    const { entry, length } = parseAt(parts.body, index);
    entries.push(entry);
    index += length;
  }
  return { prefix: parts.prefix, header: parts.header, entries };
}

export function serializeEr(model: ErModel): string {
  return joinDiagram(model, (entry) => (entry.type === "raw" ? entry.text : writeWithOrigin(entry, canonical)));
}

const isEditable = (entry: ErEntry): entry is EditableEntry => entry.type !== "raw";
const indentAt = (entries: ErEntry[], index: number) => indentNear(entries, index, (entry) => (isEditable(entry) ? entry.indent : undefined));

/** Names of the entities that are declared with attributes or used in a relationship, in order of appearance. */
export function entityNames(model: ErModel): string[] {
  const names: string[] = [];
  const add = (name: string) => {
    if (!names.includes(name)) names.push(name);
  };
  for (const entry of model.entries) {
    if (entry.type === "entity") add(entry.name);
    else if (entry.type === "relationship") {
      add(entry.left);
      add(entry.right);
    }
  }
  return names;
}

/** An entity can be renamed only while no other line mentions it. Otherwise a relationship would point to an entity that does not exist. */
export function canRename(model: ErModel, index: number): boolean {
  const target = model.entries[index];
  if (target?.type !== "entity") return false;
  return isUnreferenced(model.entries, index, target.name, (entry) => (entry.type === "relationship" ? [entry.left, entry.right] : entry.type === "entity" ? [entry.name] : []));
}

const NAME_ONLY = new RegExp(`^${NAME}$`);

/** Renames the entity at `index`. Nothing changes when the name is empty, written badly or taken, or when the entity is in use. */
export function renameEntity(model: ErModel, index: number, name: string): ErModel {
  const value = name.trim();
  if (!canRename(model, index) || !NAME_ONLY.test(value) || entityNames(model).includes(value)) return model;
  return updateEntity(model, index, { name: value });
}

export const updateEntity = (model: ErModel, index: number, patch: Partial<Entity>): ErModel => patchEntry<ErEntry, ErModel>(model, index, "entity", patch);

export const updateRelationship = (model: ErModel, index: number, patch: Partial<Relationship>): ErModel => patchEntry<ErEntry, ErModel>(model, index, "relationship", patch);

export { removeAt as removeEntry };

/** Entities change places with entities and relationships with relationships. A line the editor does not know never moves. */
export const moveEntry = (model: ErModel, index: number, step: -1 | 1): ErModel => moveSameType(model, index, step);

export const canMove = (model: ErModel, index: number, step: -1 | 1): boolean => moveEntry(model, index, step) !== model;

export function newAttribute(name: string): Attribute {
  return { type: "string", name, keys: [], comment: "" };
}

/** A new entity with one attribute goes after the last entity that is declared, or at the start. */
export function addEntity(model: ErModel, baseName: string, attributeName: string): ErModel {
  const name = uniqueName(baseName.replace(/\s+/g, "_") || "ENTITY", entityNames(model));
  const { last, at } = afterLast(model.entries, "entity");
  return insertAt(model, at, { type: "entity", name, attributes: [newAttribute(attributeName)], indent: indentAt(model.entries, Math.max(last, 0)) } satisfies Entity);
}

export function addRelationship(model: ErModel, label: string): ErModel {
  const names = entityNames(model);
  const [first = "A"] = names;
  const second = names[1] ?? first;
  const entry: Relationship = {
    type: "relationship",
    left: first,
    leftCardinality: "||",
    line: "--",
    rightCardinality: "o{",
    right: second,
    label,
    indent: topLevelIndent(model.entries),
  };
  return { ...model, entries: [...model.entries, entry] };
}
