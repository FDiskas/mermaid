import {
  hasStatementBreak,
  insertAt,
  joinDiagram,
  mentions,
  patchEntry,
  removeAt,
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

export const COMMIT_TYPES = ["NORMAL", "REVERSE", "HIGHLIGHT"] as const;
export type CommitType = (typeof COMMIT_TYPES)[number];

/** The name of the branch every graph starts on. */
export const DEFAULT_BRANCH = "main";

/** The options a commit and a merge can have. Empty means "not set". */
interface CommitOptions {
  id: string;
  tag: string;
  commitType: string;
}

export interface Commit extends EntryBase, CommitOptions {
  type: "commit";
}

export interface Branch extends EntryBase {
  type: "branch";
  name: string;
  /** Position of the branch lane, or empty. */
  order: string;
}

export interface Checkout extends EntryBase {
  type: "checkout";
  /** `checkout` or its synonym `switch`. */
  word: "checkout" | "switch";
  name: string;
}

export interface Merge extends EntryBase, CommitOptions {
  type: "merge";
  name: string;
}

export type GitEntry = Commit | Branch | Checkout | Merge | RawEntry;
export type GitModel = LineModel<GitEntry>;
type EditableEntry = Commit | Branch | Checkout | Merge;

/** A name in quotes (it can hold a space) is left to the code editor. */
const NAME = String.raw`[^\s"]+`;
const COMMIT = /^(\s*)commit(?:\s+(.*?))?\s*$/;
const BRANCH = new RegExp(String.raw`^(\s*)branch\s+(${NAME})(?:\s+order:\s*(\d+))?\s*$`);
const CHECKOUT = new RegExp(String.raw`^(\s*)(checkout|switch)\s+(${NAME})\s*$`);
const MERGE = new RegExp(String.raw`^(\s*)merge\s+(${NAME})(?:\s+(.*?))?\s*$`);
const OPTION = /^(id|tag|type):\s*(?:"([^"]*)"|([A-Za-z_][\w-]*))\s*/;

const quoted = (text: string) => `"${text.replace(/["\r\n;]+/g, " ").trim()}"`;
/** Written in place of an empty branch name. */
const EMPTY_BRANCH = "branch";
/** A typed branch name cannot hold a space, because the editor writes it without quotes. */
const branchName = (text: string) => text.trim().replace(/[\r\n;"]+/g, "").replace(/\s+/g, "-");

function writeOptions({ id, tag, commitType }: CommitOptions): string {
  const parts: string[] = [];
  if (id.trim()) parts.push(`id: ${quoted(id)}`);
  if (tag.trim()) parts.push(`tag: ${quoted(tag)}`);
  if (commitType.trim()) parts.push(`type: ${commitType.trim()}`);
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

/** Reads `id: "x" tag: "y" type: HIGHLIGHT`. Gives `null` for anything else, so the line stays as it is. */
function parseOptions(text: string): CommitOptions | null {
  const options: CommitOptions = { id: "", tag: "", commitType: "" };
  const seen = new Set<string>();
  let rest = text.trim();
  while (rest !== "") {
    const match = OPTION.exec(rest);
    const key = match?.[1];
    if (!match || !key || seen.has(key)) return null;
    seen.add(key);
    const value = match[2] ?? match[3] ?? "";
    if (key === "id") options.id = value;
    else if (key === "tag") options.tag = value;
    else options.commitType = value;
    rest = rest.slice(match[0].length);
  }
  return options;
}

function canonical(entry: EditableEntry): string {
  switch (entry.type) {
    case "commit":
      return `${entry.indent}commit${writeOptions(entry)}`;
    case "branch": {
      const order = entry.order.trim();
      return `${entry.indent}branch ${branchName(entry.name) || EMPTY_BRANCH}${/^\d+$/.test(order) ? ` order: ${order}` : ""}`;
    }
    case "checkout":
      return `${entry.indent}${entry.word} ${branchName(entry.name) || DEFAULT_BRANCH}`;
    case "merge":
      return `${entry.indent}merge ${branchName(entry.name) || DEFAULT_BRANCH}${writeOptions(entry)}`;
  }
}

function parseLine(line: string): GitEntry {
  const raw: RawEntry = { type: "raw", text: line };
  if (hasStatementBreak(line)) return raw;

  const commit = COMMIT.exec(line);
  if (commit) {
    const options = parseOptions(commit[2] ?? "");
    return options ? withOrigin({ type: "commit", ...options, indent: commit[1] ?? "" }, line, canonical) : raw;
  }
  const branch = BRANCH.exec(line);
  if (branch) return withOrigin({ type: "branch", name: branch[2] ?? "", order: branch[3] ?? "", indent: branch[1] ?? "" }, line, canonical);

  const checkout = CHECKOUT.exec(line);
  if (checkout) return withOrigin({ type: "checkout", word: checkout[2] as Checkout["word"], name: checkout[3] ?? "", indent: checkout[1] ?? "" }, line, canonical);

  const merge = MERGE.exec(line);
  if (merge) {
    const options = parseOptions(merge[3] ?? "");
    return options ? withOrigin({ type: "merge", name: merge[2] ?? "", ...options, indent: merge[1] ?? "" }, line, canonical) : raw;
  }
  return raw;
}

export function parseGitGraph(code: string): GitModel | null {
  const parts = splitDiagram(code, /^gitGraph\b/);
  if (!parts) return null;
  return { prefix: parts.prefix, header: parts.header, entries: parts.body.map(parseLine) };
}

export function serializeGitGraph(model: GitModel): string {
  return joinDiagram(model, (entry) => (entry.type === "raw" ? entry.text : writeWithOrigin(entry, canonical)));
}

/** The default branch and every branch that is created. */
export function branchNames(model: GitModel): string[] {
  return [DEFAULT_BRANCH, ...model.entries.flatMap((entry) => (entry.type === "branch" && entry.name !== DEFAULT_BRANCH ? [entry.name] : []))];
}

/** A branch can be renamed while no line the editor cannot read mentions it. */
export function canRenameBranch(model: GitModel, index: number): boolean {
  const entry = model.entries[index];
  return entry?.type === "branch" && model.entries.every((other) => other.type !== "raw" || !mentions(other.text, entry.name));
}

/** Renames the branch at `index` and every checkout and merge that names it. Nothing changes when the name is empty or taken. */
export function renameBranch(model: GitModel, index: number, name: string): GitModel {
  const entry = model.entries[index];
  const value = branchName(name);
  if (entry?.type !== "branch" || !canRenameBranch(model, index) || value === "" || value === entry.name || branchNames(model).includes(value)) return model;
  const entries = model.entries.map((other, i) => {
    if (i === index) return { ...entry, name: value };
    return (other.type === "checkout" || other.type === "merge") && other.name === entry.name ? { ...other, name: value } : other;
  });
  return { ...model, entries };
}

export function updateEntry(model: GitModel, index: number, patch: Partial<Commit> | Partial<Branch> | Partial<Checkout> | Partial<Merge>): GitModel {
  const entry = model.entries[index];
  return entry && entry.type !== "raw" ? patchEntry<GitEntry, GitModel>(model, index, entry.type, patch) : model;
}

export { removeAt as removeEntry };

/** Commands change places with each other. A line the editor does not know never moves. */
export function moveEntry(model: GitModel, index: number, step: -1 | 1): GitModel {
  const entries = swapNeighbour(model.entries, index, step, (a, b) => a.type !== "raw" && b.type !== "raw");
  return entries === model.entries ? model : { ...model, entries };
}

export const canMove = (model: GitModel, index: number, step: -1 | 1): boolean => moveEntry(model, index, step) !== model;

const append = (model: GitModel, entry: EditableEntry): GitModel => insertAt(model, model.entries.length, entry);
const none: CommitOptions = { id: "", tag: "", commitType: "" };

export function addCommit(model: GitModel): GitModel {
  return append(model, { type: "commit", ...none, indent: topLevelIndent(model.entries) });
}

/** A new branch also becomes the current branch, as in Mermaid. */
export function addBranch(model: GitModel, baseName: string): GitModel {
  const name = uniqueName(baseName, branchNames(model));
  return append(model, { type: "branch", name, order: "", indent: topLevelIndent(model.entries) });
}

export function addCheckout(model: GitModel): GitModel {
  const [first = DEFAULT_BRANCH] = branchNames(model);
  return append(model, { type: "checkout", word: "checkout", name: first, indent: topLevelIndent(model.entries) });
}

export function addMerge(model: GitModel): GitModel {
  const [first = DEFAULT_BRANCH, second = first] = branchNames(model);
  return append(model, { type: "merge", name: second, ...none, indent: topLevelIndent(model.entries) });
}
