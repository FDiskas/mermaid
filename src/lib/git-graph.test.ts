import { expect, test } from "bun:test";
import { addBranch, addCheckout, addCommit, addMerge, branchNames, canMove, canRenameBranch, moveEntry, parseGitGraph, removeEntry, renameBranch, serializeGitGraph, updateEntry } from "./git-graph";

const SAMPLE = `gitGraph LR:
    commit id: "init" tag:"v0"
    branch develop order: 2
    checkout develop
    commit type: HIGHLIGHT
    cherry-pick id: "init"
    switch main
    merge develop tag: "v1"
    commit
`;

test("writes the code unchanged when nothing was edited", () => {
  expect(serializeGitGraph(parseGitGraph(SAMPLE)!)).toBe(SAMPLE);
});

test("understands the commands and keeps the rest as raw lines", () => {
  const model = parseGitGraph(SAMPLE)!;
  expect(model.entries.map((entry) => entry.type)).toEqual(["commit", "branch", "checkout", "commit", "raw", "checkout", "merge", "commit"]);
  expect(model.entries[0]).toMatchObject({ id: "init", tag: "v0", commitType: "" });
  expect(model.entries[1]).toMatchObject({ name: "develop", order: "2" });
  expect(model.entries[5]).toMatchObject({ word: "switch", name: "main" });
  expect(model.entries[6]).toMatchObject({ name: "develop", tag: "v1" });
  expect(branchNames(model)).toEqual(["main", "develop"]);
});

test("options the editor does not know leave the line raw", () => {
  const code = 'gitGraph\n    commit msg: "old"\n    commit id: "a" id: "b"\n    branch "my branch"\n    merge a parent: x\n';
  const model = parseGitGraph(code)!;
  expect(model.entries.map((entry) => entry.type)).toEqual(["raw", "raw", "raw", "raw"]);
  expect(serializeGitGraph(model)).toBe(code);
});

test("changes the options of a commit and writes them in a fixed order", () => {
  const model = updateEntry(parseGitGraph(SAMPLE)!, 0, { commitType: "REVERSE", tag: "" });
  expect(serializeGitGraph(model)).toContain('    commit id: "init" type: REVERSE\n');
});

test("a quote in a typed text cannot break the line", () => {
  const model = updateEntry(parseGitGraph(SAMPLE)!, 0, { id: 'a"b' });
  expect(serializeGitGraph(model)).toContain('commit id: "a b" tag: "v0"');
});

test("a branch name has no space", () => {
  const model = updateEntry(parseGitGraph(SAMPLE)!, 1, { name: "my branch", order: "" });
  expect(serializeGitGraph(model)).toContain("    branch my-branch\n");
});

test("adds commands at the end", () => {
  let model = parseGitGraph("gitGraph\n    commit\n")!;
  model = addBranch(model, "develop");
  model = addCommit(model);
  model = addCheckout(model);
  model = addMerge(model);
  expect(serializeGitGraph(model)).toBe("gitGraph\n    commit\n    branch develop\n    commit\n    checkout main\n    merge develop\n");
});

test("a second new branch gets a free name", () => {
  const model = addBranch(addBranch(parseGitGraph("gitGraph\n")!, "develop"), "develop");
  expect(branchNames(model)).toEqual(["main", "develop", "develop2"]);
});

test("removes a command", () => {
  const code = serializeGitGraph(removeEntry(parseGitGraph(SAMPLE)!, 3));
  expect(code).not.toContain("HIGHLIGHT");
});

test("commands move over each other but not over a raw line", () => {
  const model = parseGitGraph(SAMPLE)!;
  expect(canMove(model, 2, 1)).toBe(true);
  expect(canMove(model, 3, 1)).toBe(false);
  expect(moveEntry(model, 0, 1).entries[0]).toMatchObject({ type: "branch" });
});

test("keeps the prefix and returns null for other diagrams", () => {
  const code = "---\ntitle: x\n---\ngitGraph\n    commit\n";
  expect(serializeGitGraph(parseGitGraph(code)!)).toBe(code);
  expect(parseGitGraph("pie\n")).toBeNull();
});

test("renaming a branch renames its checkouts and merges", () => {
  const code = serializeGitGraph(renameBranch(parseGitGraph(SAMPLE)!, 1, "feature"));
  expect(code).toContain("branch feature order: 2");
  expect(code).toContain("checkout feature");
  expect(code).toContain("merge feature tag");
  expect(code).not.toContain("develop");
});

test("a branch name that is taken or empty changes nothing", () => {
  const model = parseGitGraph(SAMPLE)!;
  expect(renameBranch(model, 1, "main")).toBe(model);
  expect(renameBranch(model, 1, "  ")).toBe(model);
});

test("a branch that a raw line mentions cannot be renamed", () => {
  const model = parseGitGraph("gitGraph\n    branch dev\n    merge dev parent: x\n")!;
  expect(canRenameBranch(model, 0)).toBe(false);
  expect(renameBranch(model, 0, "other")).toBe(model);
});
