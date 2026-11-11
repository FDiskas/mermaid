import { expect, test } from "bun:test";
import { parsePie, serializePie } from "./pie";

const SAMPLE = `pie showData title Time Distribution
    "Coding" : 40
    "Debugging" : 25.5
`;

test("parses header options and slices", () => {
  expect(parsePie(SAMPLE)).toEqual({
    prefix: "",
    showData: true,
    title: "Time Distribution",
    slices: [
      { label: "Coding", value: 40 },
      { label: "Debugging", value: 25.5 },
    ],
    extra: [],
  });
});

test("understands a title on its own line and keeps unknown lines", () => {
  const model = parsePie('%%{init: {}}%%\npie\n  title Pets\n  accTitle: Pets\n  "Cats" : 3\n')!;
  expect(model.title).toBe("Pets");
  expect(model.extra).toEqual(["accTitle: Pets"]);
  expect(model.prefix).toBe("%%{init: {}}%%");
});

test("round-trips", () => {
  expect(serializePie(parsePie(SAMPLE)!)).toBe(SAMPLE);
});

test("returns null for other diagrams", () => {
  expect(parsePie("flowchart TD\nA-->B")).toBeNull();
});
