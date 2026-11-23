import { expect, test } from "bun:test";
import { journeyFocus, journeySectionKey, journeyTaskKey } from "./journey";

test("tasks and titled sections are items with their text and line", () => {
  const code = "journey\n    title Day\n    section Work\n      Make tea: 5: Me\n      Do work: 1\n    section Home\n      Sit down: 5: Me\n";
  expect(journeyFocus.items(code)).toEqual([
    { key: journeySectionKey(0), from: 2, to: 2, text: "Work", kind: "section" },
    { key: journeyTaskKey(0), from: 3, to: 3, text: "Make tea", kind: "task" },
    { key: journeyTaskKey(1), from: 4, to: 4, text: "Do work", kind: "task" },
    { key: journeySectionKey(1), from: 5, to: 5, text: "Home", kind: "section" },
    { key: journeyTaskKey(2), from: 6, to: 6, text: "Sit down", kind: "task" },
  ]);
});

test("unknown lines, comments and the title are skipped", () => {
  const code = "journey\n    title Day\n    accTitle: Hello\n    %% Make tea: 5\n    section A\n    Cook: 3: Me\n";
  expect(journeyFocus.items(code).map((item) => [item.key, item.from])).toEqual([
    [journeySectionKey(0), 4],
    [journeyTaskKey(0), 5],
  ]);
});

test("tasks before the first section make an untitled section 0, so the next section is 1", () => {
  const items = journeyFocus.items("journey\n  Early: 4: Me\n  section Work\n  Late: 2\n");
  expect(items.map((item) => item.key)).toEqual([journeyTaskKey(0), journeySectionKey(1), journeyTaskKey(1)]);
});

test("lines before the header (front matter) shift the line numbers", () => {
  const items = journeyFocus.items("---\ntitle: X\n---\njourney\n  section A\n  Cook: 3\n");
  expect(items.map((item) => item.from)).toEqual([4, 5]);
});

test("other diagrams have no items", () => {
  expect(journeyFocus.items("flowchart TD\nA-->B")).toEqual([]);
});
