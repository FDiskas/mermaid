import { expect, test } from "bun:test";
import { ganttFocus, ganttSectionKey, ganttTaskKey } from "./gantt";

test("tasks and titled sections are items with their text and line", () => {
  const code = "gantt\n    title Plan\n    dateFormat YYYY-MM-DD\n    section Design\n    Research :done, a1, 2025-01-01, 7d\n    Wireframes :a2, after a1, 5d\n    section Build\n    Testing :7d\n";
  expect(ganttFocus.items(code)).toEqual([
    { key: ganttSectionKey(0), from: 3, to: 3, text: "Design", kind: "section" },
    { key: ganttTaskKey(0), from: 4, to: 4, text: "Research", kind: "task" },
    { key: ganttTaskKey(1), from: 5, to: 5, text: "Wireframes", kind: "task" },
    { key: ganttSectionKey(1), from: 6, to: 6, text: "Build", kind: "section" },
    { key: ganttTaskKey(2), from: 7, to: 7, text: "Testing", kind: "task" },
  ]);
});

test("settings, comments and unknown lines are skipped", () => {
  const code = "gantt\n    title Plan\n    excludes weekends\n    %% Fake: 2025-01-01, 1d\n    todayMarker off\n    Real :2025-01-01, 1d\n";
  expect(ganttFocus.items(code).map((item) => [item.key, item.from])).toEqual([[ganttTaskKey(0), 5]]);
});

test("tasks with the same or an empty-looking name are separate items", () => {
  const items = ganttFocus.items("gantt\n  Same :a, 2025-01-01, 1d\n  Same :2025-01-05, 1d\n  Same :crit, 2025-01-03, 1d\n");
  expect(items.map((item) => [item.key, item.text])).toEqual([
    [ganttTaskKey(0), "Same"],
    [ganttTaskKey(1), "Same"],
    [ganttTaskKey(2), "Same"],
  ]);
});

test("tasks before the first section make an untitled section 0, so the next section is 1", () => {
  const items = ganttFocus.items("gantt\n  Early :2025-01-10, 3d\n  section Work\n  Late :2025-02-01, 1d\n");
  expect(items.map((item) => item.key)).toEqual([ganttTaskKey(0), ganttSectionKey(1), ganttTaskKey(1)]);
});

test("the text is normalized like the label Mermaid draws", () => {
  expect(ganttFocus.items("gantt\n  Build   the   thing :2025-01-01, 1d\n")[0]?.text).toBe("Build the thing");
});

test("other diagrams have no items", () => {
  expect(ganttFocus.items("flowchart TD\nA-->B")).toEqual([]);
});
