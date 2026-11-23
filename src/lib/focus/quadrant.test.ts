import { expect, test } from "bun:test";
import { QUADRANT_TITLE_KEY, axisKey, pointKey, quadrantFocus, quadrantKey } from "./quadrant";

const template = `quadrantChart
    title Reach
    x-axis Low Reach --> High Reach
    y-axis Low Engagement --> High Engagement
    quadrant-1 Expand
    quadrant-3 Re-evaluate
    Campaign A: [0.3, 0.6]
    Campaign B: [0.45, 0.23]
`;

test("lists the title, axis ends, quadrants and points with their lines", () => {
  expect(quadrantFocus.items(template).map((item) => [item.key, item.from, item.text])).toEqual([
    [QUADRANT_TITLE_KEY, 1, "Reach"],
    [axisKey("xLeft"), 2, "Low Reach"],
    [axisKey("xRight"), 2, "High Reach"],
    [axisKey("yBottom"), 3, "Low Engagement"],
    [axisKey("yTop"), 3, "High Engagement"],
    [quadrantKey(0), 4, "Expand"],
    [quadrantKey(2), 5, "Re-evaluate"],
    [pointKey(0), 6, "Campaign A"],
    [pointKey(1), 7, "Campaign B"],
  ]);
});

test("skips comments and unknown lines, drops :::class from names and keeps the last of a repeated setting", () => {
  const code = `quadrantChart
    %% Hidden: [0.1, 0.1]
    classDef c1 color: #ff0000
    title First
    title Second
    x-axis Only left
    Styled:::c1: [0.1, 0.2] color: #fff
    Dup: [0.1, 0.1]
    Dup: [0.9, 0.9]
`;
  const items = quadrantFocus.items(code);
  expect(items.map((item) => [item.key, item.from, item.text])).toEqual([
    [QUADRANT_TITLE_KEY, 4, "Second"],
    [axisKey("xLeft"), 5, "Only left"],
    [pointKey(0), 6, "Styled"],
    [pointKey(1), 7, "Dup"],
    [pointKey(2), 8, "Dup"],
  ]);
});

test("gives no items for other diagrams", () => {
  expect(quadrantFocus.items("mindmap\n  root\n")).toEqual([]);
});
