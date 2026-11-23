import { expect, test } from "bun:test";
import { sequenceFocus } from "./sequence";

const CODE = `sequenceDiagram
    participant U as User
    participant S
    loop every minute
      U->>S: ping
    end
    Note over U,S: hello
`;

test("typed entries are items keyed by entry index; raw lines are skipped", () => {
  expect(sequenceFocus.items(CODE)).toEqual([
    { key: "0", from: 1, to: 1, kind: "participant", text: "User" },
    { key: "1", from: 2, to: 2, kind: "participant", text: "S" },
    { key: "3", from: 4, to: 4, kind: "message", text: "ping" },
    { key: "5", from: 6, to: 6, kind: "note", text: "hello" },
  ]);
});

test("other diagrams have no items", () => {
  expect(sequenceFocus.items("pie\n")).toEqual([]);
});
