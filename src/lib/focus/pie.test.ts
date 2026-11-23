import { expect, test } from "bun:test";
import { pieFocus, sliceKey } from "./pie";

test("each slice line is an item with its label", () => {
  const code = 'pie showData title Pets\n    "Cats" : 40\n    accTitle: x\n    "Dogs" : 25.5\n';
  expect(pieFocus.items(code)).toEqual([
    { key: sliceKey(0), from: 1, to: 1, text: "Cats" },
    { key: sliceKey(1), from: 3, to: 3, text: "Dogs" },
  ]);
});

test("a title line that looks like a slice is not read before the header", () => {
  expect(pieFocus.items('%% "x" : 1\npie\n  "A" : 1\n')).toEqual([{ key: sliceKey(0), from: 2, to: 2, text: "A" }]);
});

test("other diagrams have no items", () => {
  expect(pieFocus.items("flowchart TD\nA-->B")).toEqual([]);
});
