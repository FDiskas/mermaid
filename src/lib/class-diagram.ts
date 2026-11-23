import {
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

/** Longest first, so the pattern does not stop at a shorter arrow. */
export const RELATION_ARROWS = ["<|--", "--|>", "*--", "--*", "o--", "--o", "<|..", "..|>", "<--", "-->", "<..", "..>", "--", ".."] as const;
export type RelationArrow = (typeof RELATION_ARROWS)[number];

/** A class with its members. A class without members is written as one line, otherwise as a block. */
export interface ClassBlock extends EntryBase {
  type: "class";
  name: string;
  /** Members and annotations (`<<interface>>`), one per line. */
  members: string[];
}

/** `from "fromCardinality" arrow "toCardinality" to : label` */
export interface Relation extends EntryBase {
  type: "relation";
  from: string;
  fromCardinality: string;
  arrow: RelationArrow;
  toCardinality: string;
  to: string;
  label: string;
}

export type ClassEntry = ClassBlock | Relation | RawEntry;
export type ClassModel = LineModel<ClassEntry>;
type EditableEntry = ClassBlock | Relation;

const NAME = String.raw`[^\s"{}:;]+`;
const ARROW = RELATION_ARROWS.map((arrow) => arrow.replace(/[|*.]/g, "\\$&")).join("|");
const RELATION = new RegExp(String.raw`^(\s*)(${NAME})\s+(?:"([^"]*)"\s+)?(${ARROW})\s+(?:"([^"]*)"\s+)?(${NAME})\s*(?::\s*(.*))?$`);
const CLASS_OPEN = new RegExp(String.raw`^(\s*)class\s+(${NAME})\s*\{\s*$`);
const CLASS_LINE = new RegExp(String.raw`^(\s*)class\s+(${NAME})\s*$`);

const quoteSafe = (text: string) => text.replace(/"/g, "'");

function canonical(entry: EditableEntry): string {
  if (entry.type === "relation") {
    const label = escapeText(entry.label);
    const cardinality = (text: string) => (text.trim() ? `"${quoteSafe(text.trim())}"` : "");
    const parts = [entry.from, cardinality(entry.fromCardinality), entry.arrow, cardinality(entry.toCardinality), entry.to].filter(Boolean);
    return `${entry.indent}${parts.join(" ")}${label ? ` : ${label}` : ""}`;
  }
  const members = entry.members.map((member) => escapeText(member)).filter((member) => member !== "" && member !== "}");
  if (members.length === 0) return `${entry.indent}class ${entry.name}`;
  const inner = entry.indent + INDENT;
  return [`${entry.indent}class ${entry.name} {`, ...members.map((member) => `${inner}${member}`), `${entry.indent}}`].join("\n");
}

/** Reads the entry that starts at `lines[index]`. `length` is how many lines it covers. */
function parseAt(lines: string[], index: number): { entry: ClassEntry; length: number } {
  const line = lines[index] ?? "";
  const raw = (): { entry: ClassEntry; length: number } => ({ entry: { type: "raw", text: line }, length: 1 });
  if (hasStatementBreak(line)) return raw();

  const open = CLASS_OPEN.exec(line);
  if (open) {
    const end = lines.findIndex((candidate, i) => i > index && candidate.trim() === "}");
    const body = end === -1 ? [] : lines.slice(index + 1, end);
    const closed = end !== -1 && body.every((member) => !member.includes("{") && !member.includes("}") && !hasStatementBreak(member));
    if (!closed) return raw();
    const members = body.map((member) => member.trim()).filter(Boolean);
    const source = lines.slice(index, end + 1).join("\n");
    return { entry: withOrigin({ type: "class", name: open[2] ?? "", members, indent: open[1] ?? "" }, source, canonical), length: end - index + 1 };
  }
  const single = CLASS_LINE.exec(line);
  if (single) return { entry: withOrigin({ type: "class", name: single[2] ?? "", members: [], indent: single[1] ?? "" }, line, canonical), length: 1 };

  const relation = RELATION.exec(line);
  if (relation) {
    const [, indent = "", from = "", fromCardinality = "", arrow = "--", toCardinality = "", to = "", label = ""] = relation;
    const entry: Relation = { type: "relation", from, fromCardinality, arrow: arrow as RelationArrow, toCardinality, to, label: label.trim(), indent };
    return { entry: withOrigin(entry, line, canonical), length: 1 };
  }
  return raw();
}

export function parseClassDiagram(code: string): ClassModel | null {
  const parts = splitDiagram(code, /^classDiagram\b/);
  if (!parts) return null;
  const entries: ClassEntry[] = [];
  for (let index = 0; index < parts.body.length; ) {
    const { entry, length } = parseAt(parts.body, index);
    entries.push(entry);
    index += length;
  }
  return { prefix: parts.prefix, header: parts.header, entries };
}

export function serializeClassDiagram(model: ClassModel): string {
  return joinDiagram(model, (entry) => (entry.type === "raw" ? entry.text : writeWithOrigin(entry, canonical)));
}

const isEditable = (entry: ClassEntry): entry is EditableEntry => entry.type !== "raw";
const indentAt = (entries: ClassEntry[], index: number) => indentNear(entries, index, (entry) => (isEditable(entry) ? entry.indent : undefined));

/** Names of the classes that are declared or used in a relation, in order of appearance. */
export function classNames(model: ClassModel): string[] {
  const names: string[] = [];
  const add = (name: string) => {
    if (!names.includes(name)) names.push(name);
  };
  for (const entry of model.entries) {
    if (entry.type === "class") add(entry.name);
    else if (entry.type === "relation") {
      add(entry.from);
      add(entry.to);
    }
  }
  return names;
}

/**
 * A class can be renamed only while no other line mentions it. Otherwise the relations, notes and styles
 * that use the name would point to a class that does not exist.
 */
export function canRename(model: ClassModel, index: number): boolean {
  const target = model.entries[index];
  if (target?.type !== "class") return false;
  return isUnreferenced(model.entries, index, target.name, (entry) => (entry.type === "relation" ? [entry.from, entry.to] : entry.type === "class" ? [entry.name] : []));
}

const NAME_CHARACTERS = new RegExp(`^${NAME}$`);

/** Renames the class at `index`. Nothing changes when the name is empty, written badly or taken, or when the class is in use. */
export function renameClass(model: ClassModel, index: number, name: string): ClassModel {
  const value = name.trim();
  if (!canRename(model, index) || !NAME_CHARACTERS.test(value) || classNames(model).includes(value)) return model;
  return updateClass(model, index, { name: value });
}

export const updateClass = (model: ClassModel, index: number, patch: Partial<ClassBlock>): ClassModel => patchEntry<ClassEntry, ClassModel>(model, index, "class", patch);

export const updateRelation = (model: ClassModel, index: number, patch: Partial<Relation>): ClassModel => patchEntry<ClassEntry, ClassModel>(model, index, "relation", patch);

export { removeAt as removeEntry };

/** Classes change places with classes and relations with relations. A line the editor does not know never moves. */
export const moveEntry = (model: ClassModel, index: number, step: -1 | 1): ClassModel => moveSameType(model, index, step);

export const canMove = (model: ClassModel, index: number, step: -1 | 1): boolean => moveEntry(model, index, step) !== model;

/** A new class goes after the last class that is declared, or at the start. */
export function addClass(model: ClassModel, baseName: string): ClassModel {
  const name = uniqueName(baseName.replace(/\s+/g, ""), classNames(model));
  const { last, at } = afterLast(model.entries, "class");
  return insertAt(model, at, { type: "class", name, members: [], indent: indentAt(model.entries, Math.max(last, 0)) } satisfies ClassBlock);
}

export function addRelation(model: ClassModel): ClassModel {
  const names = classNames(model);
  const [from = "A"] = names;
  const to = names[1] ?? names[0] ?? "B";
  const entry: Relation = { type: "relation", from, fromCardinality: "", arrow: "-->", toCardinality: "", to, label: "", indent: topLevelIndent(model.entries) };
  return { ...model, entries: [...model.entries, entry] };
}
