import { expect, test } from "bun:test";
import { addMessage, addNote, addParticipant, canMove, knownIds, moveEntry, parseSequence, removeEntry, serializeSequence, updateEntry } from "./sequence";

const SAMPLE = `sequenceDiagram
    autonumber
    participant U as User
    actor B
    U->>B: Open the page
    loop Every minute
        B-->>U:poll
        Note over U,B: Stored locally
    end
    activate U
    B-)+U: async
`;

test("writes the code unchanged when nothing was edited", () => {
  expect(serializeSequence(parseSequence(SAMPLE)!)).toBe(SAMPLE);
});

test("understands participants, messages and notes and keeps the rest as raw lines", () => {
  const model = parseSequence(SAMPLE)!;
  expect(model.entries.map((entry) => entry.type)).toEqual(["raw", "participant", "participant", "message", "raw", "message", "note", "raw", "raw", "message"]);
  expect(model.entries[1]).toMatchObject({ kind: "participant", id: "U", label: "User" });
  expect(model.entries[5]).toMatchObject({ from: "B", arrow: "-->>", to: "U", text: "poll" });
  expect(model.entries[9]).toMatchObject({ arrow: "-)", activation: "+", text: "async" });
});

test("changes only the edited line", () => {
  const model = updateEntry(parseSequence(SAMPLE)!, 3, { text: "Open it" });
  expect(serializeSequence(model)).toBe(SAMPLE.replace("Open the page", "Open it"));
});

test("an edited line keeps its indent", () => {
  const model = updateEntry(parseSequence(SAMPLE)!, 5, { arrow: "->>" });
  expect(serializeSequence(model)).toContain("        B->>U: poll\n");
});

test("lines with a semicolon, new syntax and block lines stay raw", () => {
  const code = 'sequenceDiagram\n    A->>B: one; B->>A: two\n    participant C@{ "type": "database" }\n    rect rgb(0, 0, 0)\n    A->>B: x\n    end\n';
  const model = parseSequence(code)!;
  expect(model.entries.map((entry) => entry.type)).toEqual(["raw", "raw", "raw", "message", "raw"]);
  expect(serializeSequence(model)).toBe(code);
});

test("a typed semicolon is escaped", () => {
  const model = updateEntry(parseSequence(SAMPLE)!, 3, { text: "a; b" });
  expect(serializeSequence(model)).toContain("U->>B: a#59; b");
});

test("an empty text stays a message", () => {
  const code = serializeSequence(updateEntry(parseSequence(SAMPLE)!, 3, { text: "" }));
  expect(parseSequence(code)!.entries[3]).toMatchObject({ type: "message", text: "…" });
});

test("removes a line", () => {
  const code = serializeSequence(removeEntry(parseSequence(SAMPLE)!, 3));
  expect(code).not.toContain("Open the page");
  expect(code).toContain("loop Every minute");
});

test("lines the editor does not know never move, and nothing moves over them", () => {
  const model = parseSequence(SAMPLE)!;
  expect(canMove(model, 3, 1)).toBe(false); // the next line is `loop`
  expect(canMove(model, 5, 1)).toBe(true); // message and note
  expect(canMove(model, 1, 1)).toBe(true); // two participants
  expect(canMove(model, 4, -1)).toBe(false);
  const moved = moveEntry(model, 1, 1);
  expect(moved.entries[1]).toMatchObject({ id: "B" });
  expect(moved.entries[2]).toMatchObject({ id: "U" });
});

test("adds a participant after the last one and picks a free id", () => {
  const code = serializeSequence(addParticipant(parseSequence(SAMPLE)!, "actor"));
  expect(code).toContain("    actor B\n    actor A\n    U->>B");
});

test("a first message in an empty diagram declares two participants", () => {
  const code = serializeSequence(addMessage(parseSequence("sequenceDiagram\n")!, "Hello"));
  expect(code).toBe("sequenceDiagram\n    participant A\n    participant A2\n    A->>A2: Hello\n");
});

test("adds a note at the end", () => {
  const model = addNote(parseSequence("sequenceDiagram\n    A->>B: hi\n")!, "Remember");
  expect(serializeSequence(model)).toBe("sequenceDiagram\n    A->>B: hi\n    Note over A: Remember\n");
});

test("lists the ids that are declared or used", () => {
  expect(knownIds(parseSequence(SAMPLE)!)).toEqual(["U", "B"]);
});

test("keeps the prefix and returns null for other diagrams", () => {
  const code = "---\ntitle: x\n---\nsequenceDiagram\n    A->>B: hi\n";
  expect(serializeSequence(parseSequence(code)!)).toBe(code);
  expect(parseSequence("flowchart TD\n")).toBeNull();
});

test("a line added at the end is written outside the blocks", () => {
  const model = addMessage(parseSequence(SAMPLE)!, "Later");
  expect(serializeSequence(model).endsWith("    B-)+U: async\n    U->>B: Later\n")).toBe(true);
});
