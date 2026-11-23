import { expect, test } from "bun:test";
import { classFocus } from "./class";
import { pairText } from "./graph";

const CODE = `%% leading comment
classDiagram
    direction LR
    class Animal {
      <<abstract>>
      +String name

      +eat() void
    }

    %% a comment
    class Dog
    Animal <|-- Dog : is a
    Animal --> Dog : owns
    note for Dog "friendly"
    class Shape~T~ {
      +draw() void
    }
    Dog --|> Animal
`;

const lines = CODE.split("\n");

test("gives one item per class and relation, with the lines of its code", () => {
  const items = classFocus.items(CODE);
  expect(items.map(({ key, from, to, kind, text }) => ({ key, from, to, kind, text }))).toEqual([
    { key: "1", from: 3, to: 8, kind: "class", text: "Animal" },
    { key: "4", from: 11, to: 11, kind: "class", text: "Dog" },
    { key: "5", from: 12, to: 12, kind: "relation", text: pairText("Animal", "Dog") },
    { key: "6", from: 13, to: 13, kind: "relation", text: pairText("Animal", "Dog") },
    { key: "8", from: 15, to: 17, kind: "class", text: "Shape" },
    { key: "9", from: 18, to: 18, kind: "relation", text: pairText("Dog", "Animal") },
  ]);
});

test("the lines of an item hold the code of that item", () => {
  const items = classFocus.items(CODE);
  const first = (key: string) => lines[items.find((item) => item.key === key)?.from ?? -1]?.trim();
  const last = (key: string) => lines[items.find((item) => item.key === key)?.to ?? -1]?.trim();
  expect(first("1")).toBe("class Animal {");
  expect(last("1")).toBe("}");
  expect(first("5")).toBe("Animal <|-- Dog : is a");
  expect(last("8")).toBe("}");
  expect(first("9")).toBe("Dog --|> Animal");
});

test("skips raw lines: comments, notes, directions and blank lines", () => {
  const covered = new Set(classFocus.items(CODE).flatMap((item) => Array.from({ length: item.to - item.from + 1 }, (_, offset) => item.from + offset)));
  for (const raw of [0, 1, 2, 9, 10, 14]) expect(covered.has(raw)).toBe(false);
});

test("gives no item for code that is not a class diagram", () => {
  expect(classFocus.items("pie\n  \"a\" : 1\n")).toEqual([]);
});
