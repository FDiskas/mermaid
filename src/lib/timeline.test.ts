import { expect, test } from "bun:test";
import { parseTimeline, serializeTimeline } from "./timeline";

const SAMPLE = `timeline
    title History of social media
    2002 : LinkedIn
    2004 : Facebook : Google
`;

const SECTIONED = `timeline
    title Main steps
    section Early
        2021 : Composable architecture approved
             : SAP Commerce headless with Sanity
    section Later
        2024 Q4 : Pricing decided
`;

test("parses title and periods without sections", () => {
  expect(parseTimeline(SAMPLE)).toEqual({
    prefix: "",
    title: "History of social media",
    sections: [
      {
        title: null,
        periods: [
          { label: "2002", events: ["LinkedIn"] },
          { label: "2004", events: ["Facebook", "Google"] },
        ],
      },
    ],
    extra: [],
  });
});

test("parses sections and continuation lines", () => {
  const model = parseTimeline(SECTIONED)!;
  expect(model.sections.map((s) => s.title)).toEqual(["Early", "Later"]);
  expect(model.sections[0]!.periods).toEqual([
    { label: "2021", events: ["Composable architecture approved", "SAP Commerce headless with Sanity"] },
  ]);
  expect(model.sections[1]!.periods[0]!.label).toBe("2024 Q4");
});

test("keeps unknown lines and the prefix", () => {
  const model = parseTimeline("---\ntitle: x\n---\ntimeline\n  accTitle: Steps\n  2020 : A\n")!;
  expect(model.prefix).toBe("---\ntitle: x\n---");
  expect(model.extra).toEqual(["accTitle: Steps"]);
});

test("a period without events is kept", () => {
  expect(parseTimeline("timeline\n  2020\n")!.sections[0]!.periods).toEqual([{ label: "2020", events: [] }]);
});

test("round-trips", () => {
  expect(serializeTimeline(parseTimeline(SAMPLE)!)).toBe(SAMPLE);
});

test("round-trips sections with one event per line", () => {
  const once = serializeTimeline(parseTimeline(SECTIONED)!);
  expect(serializeTimeline(parseTimeline(once)!)).toBe(once);
  expect(parseTimeline(once)).toEqual(parseTimeline(SECTIONED));
});

test("an empty first section is not written as a section line", () => {
  const model = parseTimeline(SAMPLE)!;
  model.sections.push({ title: "Next", periods: [] });
  expect(serializeTimeline(model)).toBe(`${SAMPLE}    section Next\n`);
});

test("returns null for other diagrams", () => {
  expect(parseTimeline("flowchart TD\nA-->B")).toBeNull();
});
