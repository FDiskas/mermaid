import { expect, test } from "bun:test";
import { parseGantt, serializeGantt } from "./gantt";

const SAMPLE = `gantt
    title A Gantt Diagram
    dateFormat YYYY-MM-DD
    axisFormat %m-%d
    excludes weekends
    section Section
    A task :a1, 2014-01-01, 30d
    Another task :after a1, 20d
    section Another
    Critical :crit, done, a2, 2014-01-12, 12d
    Next :24d
    Ship :milestone, m1, 2014-02-01, 0d
`;

test("parses settings, sections and tasks", () => {
  const model = parseGantt(SAMPLE)!;
  expect([model.title, model.dateFormat, model.axisFormat]).toEqual(["A Gantt Diagram", "YYYY-MM-DD", "%m-%d"]);
  expect(model.extra).toEqual(["excludes weekends"]);
  expect(model.sections.map((s) => s.title)).toEqual(["Section", "Another"]);
  expect(model.sections[0]!.tasks).toEqual([
    { name: "A task", tags: [], id: "a1", start: "2014-01-01", end: "30d" },
    { name: "Another task", tags: [], id: "", start: "after a1", end: "20d" },
  ]);
  expect(model.sections[1]!.tasks[0]).toEqual({ name: "Critical", tags: ["crit", "done"], id: "a2", start: "2014-01-12", end: "12d" });
  expect(model.sections[1]!.tasks[1]).toEqual({ name: "Next", tags: [], id: "", start: "", end: "24d" });
  expect(model.sections[1]!.tasks[2]!.tags).toEqual(["milestone"]);
});

test("round-trips", () => {
  expect(serializeGantt(parseGantt(SAMPLE)!)).toBe(SAMPLE);
});

test("settings with colons are not tasks", () => {
  const model = parseGantt("gantt\n  axisFormat %H:%M\n  todayMarker stroke-width:5px,stroke:#0f0\n  accTitle: Plan\n  Work :3d\n")!;
  expect(model.axisFormat).toBe("%H:%M");
  expect(model.extra).toEqual(["todayMarker stroke-width:5px,stroke:#0f0", "accTitle: Plan"]);
  expect(model.sections[0]!.tasks).toHaveLength(1);
});

test("tasks before the first section are kept without a section line", () => {
  const code = "gantt\n    Work :3d\n";
  expect(serializeGantt(parseGantt(code)!)).toBe(code);
});

test("an id without a start is not written and an empty task gets a duration", () => {
  const model = parseGantt(SAMPLE)!;
  model.sections = [{ title: "S", tasks: [{ name: "", tags: [], id: "x", start: "", end: "5d" }, { name: "Y", tags: [], id: "", start: "", end: "" }] }];
  expect(serializeGantt(model)).toContain("…" + " :5d");
  expect(serializeGantt(model)).toContain("Y :1d");
});

test("keeps the prefix and returns null for other diagrams", () => {
  expect(parseGantt("%%{init: {}}%%\ngantt\n  Work :3d\n")!.prefix).toBe("%%{init: {}}%%");
  expect(parseGantt("pie\n")).toBeNull();
});
