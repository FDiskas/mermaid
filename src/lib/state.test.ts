import { expect, test } from "bun:test";
import { addState, addTransition, canMoveTransition, parseState, removeState, serializeState, setStateText, stateIds, stateText, updateTransition } from "./state";

const SAMPLE = `stateDiagram-v2
    direction LR
    [*] --> Idle
    Idle --> Loading: fetch
    state "Waiting for data" as Loading
    Success : All done
    state Failure {
        [*] --> Retry
    }
    Loading --> Success:ok
    Success --> [*]
    note right of Idle : start here
`;

test("writes the code unchanged when nothing was edited", () => {
  expect(serializeState(parseState(SAMPLE)!)).toBe(SAMPLE);
});

test("understands transitions and texts; blocks, notes and directions stay raw", () => {
  const model = parseState(SAMPLE)!;
  expect(model.entries.map((entry) => entry.type)).toEqual(["raw", "transition", "transition", "text", "text", "raw", "transition", "raw", "transition", "transition", "raw"]);
  expect(model.entries[2]).toMatchObject({ from: "Idle", to: "Loading", label: "fetch" });
  expect(model.entries[3]).toMatchObject({ id: "Loading", text: "Waiting for data", alias: true });
  expect(model.entries[4]).toMatchObject({ id: "Success", text: "All done", alias: false });
});

test("lists states without the start and end marker", () => {
  expect(stateIds(parseState(SAMPLE)!)).toEqual(["Idle", "Loading", "Success", "Retry"]);
});

test("a css class (A:::b), a title and an accessibility line are not states", () => {
  const code = "stateDiagram\n    A:::hot\n    accTitle: Machine\n    title: Machine\n";
  const model = parseState(code)!;
  expect(model.entries.every((entry) => entry.type === "raw")).toBe(true);
  expect(serializeState(model)).toBe(code);
});

test("changes the label of one transition", () => {
  const model = updateTransition(parseState(SAMPLE)!, 2, { label: "load" });
  expect(serializeState(model)).toBe(SAMPLE.replace("Idle --> Loading: fetch", "Idle --> Loading: load"));
});

test("removing the label leaves a plain transition", () => {
  const model = updateTransition(parseState(SAMPLE)!, 2, { label: "" });
  expect(serializeState(model)).toContain("    Idle --> Loading\n");
});

test("sets, changes and clears the text of a state", () => {
  let model = setStateText(parseState(SAMPLE)!, "Idle", "Waiting");
  expect(serializeState(model)).toContain("    Idle : Waiting\n");
  expect(stateText(model, "Idle")).toBe("Waiting");
  model = setStateText(model, "Idle", "");
  expect(serializeState(model)).not.toContain("    Idle :");
  // an `as` line also declares the state, so it stays
  model = setStateText(model, "Loading", "");
  expect(serializeState(model)).toContain('state "Loading" as Loading');
});

test("adds a state and a transition", () => {
  const model = addTransition(addState(parseState("stateDiagram-v2\n    [*] --> A\n")!, "New"));
  expect(serializeState(model)).toBe("stateDiagram-v2\n    [*] --> A\n    State : New\n    A --> State\n");
});

test("removing a state removes its transitions and text, not the lines it cannot read", () => {
  const code = serializeState(removeState(parseState(SAMPLE)!, "Success"));
  expect(code).not.toContain("Success");
  expect(code).toContain("state Failure {");
  expect(code).toContain("note right of Idle");
});

test("transitions only move among transitions", () => {
  const model = parseState(SAMPLE)!;
  expect(canMoveTransition(model, 1, 1)).toBe(true);
  expect(canMoveTransition(model, 2, 1)).toBe(false);
});

test("returns null for other diagrams and keeps lines with a semicolon", () => {
  expect(parseState("classDiagram\n")).toBeNull();
  const code = "stateDiagram\n    A --> B; B --> C\n";
  expect(parseState(code)!.entries[0]).toMatchObject({ type: "raw" });
});
