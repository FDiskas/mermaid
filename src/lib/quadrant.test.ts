import { expect, test } from "bun:test";
import { parseQuadrant, serializeQuadrant } from "./quadrant";

const SAMPLE = `quadrantChart
    title Reach and engagement
    x-axis Low Reach --> High Reach
    y-axis Low Engagement --> High Engagement
    quadrant-1 Expand
    quadrant-2 Promote
    quadrant-3 Re-evaluate
    quadrant-4 Improve
    Campaign A: [0.3, 0.6]
    Campaign B: [0.45, 0.23]
`;

test("parses title, axes, quadrants and points", () => {
  expect(parseQuadrant(SAMPLE)).toEqual({
    prefix: "",
    title: "Reach and engagement",
    xLeft: "Low Reach",
    xRight: "High Reach",
    yBottom: "Low Engagement",
    yTop: "High Engagement",
    quadrants: ["Expand", "Promote", "Re-evaluate", "Improve"],
    points: [
      { name: "Campaign A", x: 0.3, y: 0.6, style: "" },
      { name: "Campaign B", x: 0.45, y: 0.23, style: "" },
    ],
    extra: [],
  });
});

test("round-trips", () => {
  expect(serializeQuadrant(parseQuadrant(SAMPLE)!)).toBe(SAMPLE);
});

test("an axis can have only a left label", () => {
  const model = parseQuadrant("quadrantChart\n  x-axis Reach\n")!;
  expect([model.xLeft, model.xRight]).toEqual(["Reach", ""]);
  expect(serializeQuadrant(model)).toBe("quadrantChart\n    x-axis Reach\n");
});

test("keeps point classes and styles, classDef lines and the prefix", () => {
  const code = "%%{init: {}}%%\nquadrantChart\n  classDef big color: #109060\n  A:::big: [0.1, 0.2] radius: 12, color: #ff3300\n";
  const model = parseQuadrant(code)!;
  expect(model.prefix).toBe("%%{init: {}}%%");
  expect(model.extra).toEqual(["classDef big color: #109060"]);
  expect(model.points).toEqual([{ name: "A:::big", x: 0.1, y: 0.2, style: "radius: 12, color: #ff3300" }]);
  expect(serializeQuadrant(model)).toContain("A:::big: [0.1, 0.2] radius: 12, color: #ff3300");
});

test("coordinates are kept between 0 and 1 and an empty name stays a point", () => {
  const model = parseQuadrant(SAMPLE)!;
  model.points = [{ name: " ", x: 3, y: -1, style: "" }];
  expect(serializeQuadrant(model)).toContain("…: [1, 0]");
  expect(parseQuadrant(serializeQuadrant(model))!.points).toHaveLength(1);
});

test("returns null for other diagrams", () => {
  expect(parseQuadrant("pie\n")).toBeNull();
});
