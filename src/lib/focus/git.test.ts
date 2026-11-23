import { expect, test } from "bun:test";
import { gitFocus } from "./git";

const SAMPLE = `gitGraph
    commit
    %% a comment
    commit id: "x" tag: "v1"

    branch develop
    checkout develop
    commit msg: "not editable"
    cherry-pick id: "x"
    commit type: HIGHLIGHT
    commit id: "my id"
    branch feat order: 3
    checkout main
    merge develop
    merge feat id: "mm"
`;

const items = (code: string) => gitFocus.items(code);

test("gives every command the index of its entry, its line, its kind and what identifies it", () => {
  expect(items(SAMPLE).map(({ key, from, to, kind, text }) => [key, from, to, kind, text])).toEqual([
    ["0", 1, 1, "commit", "#0"],
    ["2", 3, 3, "commit", "x"],
    ["4", 5, 5, "branch", "develop"],
    ["5", 6, 6, "checkout", "develop"],
    ["8", 9, 9, "commit", "#4"],
    ["9", 10, 10, "commit", "#5"],
    ["10", 11, 11, "branch", "feat"],
    ["11", 12, 12, "checkout", "main"],
    ["12", 13, 13, "merge", "#6"],
    ["13", 14, 14, "merge", "mm"],
  ]);
});

test("counts the commits of lines the editor does not read, so that `#n` is the place among the drawn commits", () => {
  const code = `gitGraph
    commit msg: "a"; commit msg: "b"
    cherry-pick id: "1"
    commit
`;
  expect(items(code).map(({ text }) => text)).toEqual(["#3"]);
});

test("skips raw lines and comments", () => {
  const lines = items(SAMPLE).map((item) => item.from);
  for (const raw of [2, 4, 7, 8]) expect(lines).not.toContain(raw);
});

test("gives no items for another diagram type", () => {
  expect(items("pie\n  \"a\": 1\n")).toEqual([]);
});
