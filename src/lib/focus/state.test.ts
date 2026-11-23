import { expect, test } from "bun:test";
import { stateFocus, stateKey } from "./state";

const SAMPLE = `stateDiagram-v2
    [*] --> Idle
    %% a comment
    state "Loading data" as Loading
    Idle --> Loading: fetch

    Loading --> Failure: error
    state Failure {
      [*] --> Inner
    }
    Idle : the idle state
    note right of Idle : hi
    note left of Success
      a --> b
    end note
    Failure --> Loading: retry
    Success --> [*]
`;

const items = (code: string) => stateFocus.items(code);

test("gives a transition its entry index, its line and the edge Mermaid draws for it", () => {
  const transitions = items(SAMPLE).filter((item) => item.kind === "transition");
  expect(transitions.map(({ key, from, text }) => [key, from, text])).toEqual([
    ["0", 1, "edge0"],
    ["3", 4, "edge1"],
    ["5", 6, "edge2"],
    ["7", 8, "edge3"],
    // inside the note block: a line the editor reads as a transition, but Mermaid draws no edge for it
    ["12", 13, undefined],
    ["14", 15, "edge6"],
    ["15", 16, "edge7"],
  ]);
});

test("counts notes and transitions in lines the editor does not read as edges", () => {
  const code = `stateDiagram-v2
    %% A --> B
    A --> B
    note right of A : text
    X --> Y; Y --> Z
    B --> C: go
`;
  const transitions = items(code).filter((item) => item.kind === "transition");
  expect(transitions.map(({ text }) => text)).toEqual(["edge0", "edge4"]);
});

test("a state with a text line is on that line", () => {
  const states = Object.fromEntries(items(SAMPLE).filter((item) => item.kind === "state").map((item) => [item.key, item]));
  expect(states[stateKey("Loading")]).toMatchObject({ from: 3, to: 3, text: "Loading" });
  expect(states[stateKey("Idle")]).toMatchObject({ from: 10, to: 10 });
});

test("a state that only appears in transitions is on the first line that names it", () => {
  const states = Object.fromEntries(items(SAMPLE).filter((item) => item.kind === "state").map((item) => [item.key, item]));
  expect(states[stateKey("Inner")]).toMatchObject({ from: 8, to: 8 });
  expect(states[stateKey("Failure")]).toMatchObject({ from: 6, to: 6 });
});

test("a line is in the item of its own entry, not in a state that is only named there", () => {
  const all = items(SAMPLE);
  expect(all.find((item) => item.from <= 6 && item.to >= 6)?.key).toBe("5");
});

test("skips raw lines: comments, blocks, notes and their text", () => {
  const covered = items(SAMPLE).flatMap((item) => Array.from({ length: item.to - item.from + 1 }, (_, offset) => item.from + offset));
  for (const raw of [2, 7, 9, 11, 12, 14]) expect(covered).not.toContain(raw);
});

test("gives no items for another diagram type", () => {
  expect(items("pie\n  \"a\": 1\n")).toEqual([]);
});
