import { expect, test } from "bun:test";
import { parseJourney, serializeJourney } from "./journey";

const SAMPLE = `journey
    title My working day
    section Go to work
        Make tea: 5: Me
        Do work: 1: Me, Cat
    section Go home
        Go downstairs: 5
`;

test("parses title, sections, scores and actors", () => {
  expect(parseJourney(SAMPLE)).toEqual({
    prefix: "",
    title: "My working day",
    sections: [
      {
        title: "Go to work",
        tasks: [
          { name: "Make tea", score: 5, actors: ["Me"] },
          { name: "Do work", score: 1, actors: ["Me", "Cat"] },
        ],
      },
      { title: "Go home", tasks: [{ name: "Go downstairs", score: 5, actors: [] }] },
    ],
    extra: [],
  });
});

test("round-trips", () => {
  expect(serializeJourney(parseJourney(SAMPLE)!)).toBe(SAMPLE);
});

test("tasks before the first section are kept without a section line", () => {
  const code = "journey\n    Work: 3: Me\n";
  const model = parseJourney(code)!;
  expect(model.sections[0]!.title).toBeNull();
  expect(serializeJourney(model)).toBe(code);
});

test("keeps unknown lines and the prefix", () => {
  const model = parseJourney("---\ntitle: x\n---\njourney\n  accTitle: Day\n  %% note\n  Work: 3\n")!;
  expect(model.prefix).toBe("---\ntitle: x\n---");
  expect(model.extra).toEqual(["accTitle: Day", "%% note"]);
});

test("scores stay between 1 and 5 and an empty name stays a task", () => {
  const model = parseJourney(SAMPLE)!;
  model.sections[0]!.tasks = [{ name: "", score: 9, actors: [] }];
  const text = serializeJourney(model);
  expect(text).toContain("…: 5");
  expect(parseJourney(text)!.sections[0]!.tasks).toHaveLength(1);
});

test("returns null for other diagrams", () => {
  expect(parseJourney("timeline\n")).toBeNull();
});
