import { expect, test } from "bun:test";
import { parseTimeline } from "@/lib/timeline";
import { TIMELINE_TITLE_KEY, timelineEventKey, timelineFocus, timelinePeriodKey, timelineSectionKey } from "./timeline";

const simple = `timeline
    title History
    2002 : LinkedIn
    2004 : Facebook : Google
`;

test("lists the title, the periods and the events with their lines", () => {
  expect(timelineFocus.items(simple)).toEqual([
    { key: TIMELINE_TITLE_KEY, kind: "title", from: 1, to: 1, text: "History" },
    { key: timelinePeriodKey(0, 0), kind: "period", from: 2, to: 2, text: "2002" },
    { key: timelineEventKey(0, 0, 0), kind: "event", from: 2, to: 2, text: "LinkedIn" },
    { key: timelinePeriodKey(0, 1), kind: "period", from: 3, to: 3, text: "2004" },
    { key: timelineEventKey(0, 1, 0), kind: "event", from: 3, to: 3, text: "Facebook" },
    { key: timelineEventKey(0, 1, 1), kind: "event", from: 3, to: 3, text: "Google" },
  ]);
});

const tricky = `%% leading comment
timeline
    accTitle: hidden
    section Early
        2002 : Google : #colon;x
             : Google
        %% skipped

        2003
    section Late
        2002 : Google
`;

test("counts sections, periods and events like the model, and skips comments and accessibility lines", () => {
  const items = timelineFocus.items(tricky);
  expect(items.map((item) => [item.key, item.from, item.text])).toEqual([
    [timelineSectionKey(0), 3, "Early"],
    [timelinePeriodKey(0, 0), 4, "2002"],
    [timelineEventKey(0, 0, 0), 4, "Google"],
    [timelineEventKey(0, 0, 1), 4, ":x"],
    [timelineEventKey(0, 0, 2), 5, "Google"],
    [timelinePeriodKey(0, 1), 8, "2003"],
    [timelineSectionKey(1), 9, "Late"],
    [timelinePeriodKey(1, 0), 10, "2002"],
    [timelineEventKey(1, 0, 0), 10, "Google"],
  ]);
});

test("has the same keys as the periods and events of the model", () => {
  const model = parseTimeline(tricky)!;
  const keys = model.sections.flatMap((section, s) => section.periods.flatMap((period, p) => [timelinePeriodKey(s, p), ...period.events.map((_, e) => timelineEventKey(s, p, e))]));
  const periodAndEventKeys = timelineFocus.items(tricky).filter((item) => item.kind === "period" || item.kind === "event").map((item) => item.key);
  expect(periodAndEventKeys).toEqual(keys);
});

test("periods before the first section belong to a section without a title", () => {
  const model = parseTimeline("timeline\n  2002 : A\n  section S\n    2003 : B\n")!;
  expect(model.sections.map((section) => section.title)).toEqual([null, "S"]);
  expect(timelineFocus.items("timeline\n  2002 : A\n  section S\n    2003 : B\n").map((item) => item.key)).toEqual([
    timelinePeriodKey(0, 0),
    timelineEventKey(0, 0, 0),
    timelineSectionKey(1),
    timelinePeriodKey(1, 0),
    timelineEventKey(1, 0, 0),
  ]);
});

test("gives no items for other diagrams", () => {
  expect(timelineFocus.items("pie\n  \"a\": 1\n")).toEqual([]);
});
