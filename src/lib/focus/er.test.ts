import { expect, test } from "bun:test";
import { erFocus } from "./er";
import { pairText } from "./graph";

const CODE = `erDiagram
    %% comment
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER ||--o{ ORDER : "also buys"

    "Big Customer" ||--|{ LINE_ITEM : contains
    CUSTOMER {
      string name PK

      string email
    }
    ORDER {
      int id
    }
    ORDER ||--o{ CUSTOMER : "reverse"
`;

const lines = CODE.split("\n");

test("gives one item per entity and relationship, with the lines of its code", () => {
  const items = erFocus.items(CODE);
  expect(items.map(({ key, from, to, kind, text }) => ({ key, from, to, kind, text }))).toEqual([
    { key: "1", from: 2, to: 2, kind: "relationship", text: pairText("CUSTOMER", "ORDER") },
    { key: "2", from: 3, to: 3, kind: "relationship", text: pairText("CUSTOMER", "ORDER") },
    { key: "4", from: 5, to: 5, kind: "relationship", text: pairText("Big Customer", "LINE_ITEM") },
    { key: "5", from: 6, to: 10, kind: "entity", text: "CUSTOMER" },
    { key: "6", from: 11, to: 13, kind: "entity", text: "ORDER" },
    { key: "7", from: 14, to: 14, kind: "relationship", text: pairText("ORDER", "CUSTOMER") },
  ]);
});

test("an entity covers its blank lines and its closing brace", () => {
  const entity = erFocus.items(CODE).find((item) => item.key === "5");
  expect(lines[entity?.from ?? -1]?.trim()).toBe("CUSTOMER {");
  expect(lines[entity?.to ?? -1]?.trim()).toBe("}");
});

test("skips raw lines: comments and blank lines", () => {
  const covered = new Set(erFocus.items(CODE).flatMap((item) => Array.from({ length: item.to - item.from + 1 }, (_, offset) => item.from + offset)));
  expect(covered.has(1)).toBe(false);
  expect(covered.has(4)).toBe(false);
});

test("gives no item for code that is not an ER diagram", () => {
  expect(erFocus.items("pie\n  \"a\" : 1\n")).toEqual([]);
});
