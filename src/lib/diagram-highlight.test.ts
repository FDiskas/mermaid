import { expect, test } from "bun:test";
import { tokenizeDiagram } from "./diagram-highlight";

/** `role:text` for every token, grouped per line, to keep the expectations short. */
function describeTokens(code: string): string[][] {
  const lineStarts = code.split("\n").reduce<number[]>((starts, line, i) => [...starts, (starts[i] ?? 0) + line.length + 1], [0]);
  const result: string[][] = code.split("\n").map(() => []);
  for (const token of tokenizeDiagram(code)) {
    const line = lineStarts.findLastIndex((start) => start <= token.from);
    result[line]!.push(`${token.role}:${code.slice(token.from, token.to)}`);
  }
  return result;
}

test("timeline: marks keyword, title and periods", () => {
  const tokens = describeTokens("timeline\n    title My steps\n    2004 : Facebook : Google");
  expect(tokens[0]).toEqual(["keyword:timeline"]);
  expect(tokens[1]).toEqual(["keyword:title", "string:My steps"]);
  expect(tokens[2]).toEqual(["number:2004", "operator::", "string:Facebook", "operator::", "string:Google"]);
});

test("timeline: marks sections and continuation lines", () => {
  const tokens = describeTokens("timeline\n  section Early\n  2021 : A\n       : B");
  expect(tokens[1]).toEqual(["keyword:section", "string:Early"]);
  expect(tokens[3]).toEqual(["operator::", "string:B"]);
});

test("timeline: marks comments and accessibility lines", () => {
  const tokens = describeTokens("%% note\ntimeline\n  accTitle: Steps");
  expect(tokens[0]).toEqual(["comment:%% note"]);
  expect(tokens[2]).toEqual(["keyword:accTitle", "operator::", "string:Steps"]);
});

test("front matter is skipped but the keyword is found", () => {
  const tokens = describeTokens("---\ntitle: x\n---\ntimeline\n  2020 : A");
  expect(tokens[1]).toEqual([]);
  expect(tokens[3]).toEqual(["keyword:timeline"]);
});

test("quadrant: axes, quadrant names and points", () => {
  const tokens = describeTokens(
    "quadrantChart\n  title Reach\n  x-axis Low Reach --> High Reach\n  quadrant-1 Expand\n  Campaign A: [0.3, 0.6]\n  B:::big: [0.1, 0.2] radius: 12, color: #ff3300",
  );
  expect(tokens[0]).toEqual(["keyword:quadrantChart"]);
  expect(tokens[1]).toEqual(["keyword:title", "string:Reach"]);
  expect(tokens[2]).toEqual(["keyword:x-axis", "string:Low Reach", "operator:-->", "string:High Reach"]);
  expect(tokens[3]).toEqual(["keyword:quadrant-1", "string:Expand"]);
  expect(tokens[4]).toEqual(["string:Campaign A", "operator::", "operator:[", "number:0.3", "operator:,", "number:0.6", "operator:]"]);
  expect(tokens[5]).toContain("identifier::::big");
  expect(tokens[5]).toContain("identifier:radius");
  expect(tokens[5]).toContain("number:#ff3300");
});

test("class: keywords, names, arrows, members and labels", () => {
  const tokens = describeTokens('classDiagram\n  class Animal {\n    +String name\n  }\n  Animal "1" --> "*" Dog : has\n  <<interface>> Shape');
  expect(tokens[1]).toEqual(["keyword:class", "identifier:Animal", "operator:{"]);
  expect(tokens[2]![0]).toBe("operator:+");
  expect(tokens[4]).toEqual(["identifier:Animal", 'string:"1"', "operator:-->", 'string:"*"', "identifier:Dog", "operator::", "string:has"]);
  expect(tokens[5]).toEqual(["keyword:<<interface>>", "identifier:Shape"]);
});

test("state: start marker, transitions, labels and declarations", () => {
  const tokens = describeTokens('stateDiagram-v2\n  [*] --> Idle\n  Idle --> Loading: fetch\n  state "Long name" as long1\n  note right of Idle : hi');
  expect(tokens[0]).toEqual(["keyword:stateDiagram-v2"]);
  expect(tokens[1]).toEqual(["operator:[*]", "operator:-->", "identifier:Idle"]);
  expect(tokens[2]).toEqual(["identifier:Idle", "operator:-->", "identifier:Loading", "operator::", "string:fetch"]);
  expect(tokens[3]).toEqual(["keyword:state", 'string:"Long name"', "keyword:as", "identifier:long1"]);
  expect(tokens[4]).toEqual(["keyword:note", "keyword:right", "keyword:of", "identifier:Idle", "operator::", "string:hi"]);
});

test("er: relations, labels and attribute keys", () => {
  const tokens = describeTokens('erDiagram\n  CUSTOMER ||--o{ ORDER : "is in"\n  CUSTOMER {\n    int id PK\n  }');
  expect(tokens[1]).toEqual(["identifier:CUSTOMER", "operator:||--o{", "identifier:ORDER", "operator::", 'string:"is in"']);
  expect(tokens[2]).toEqual(["identifier:CUSTOMER", "operator:{"]);
  expect(tokens[3]).toContain("keyword:PK");
});

test("git: commands, branch names and attributes", () => {
  const tokens = describeTokens('gitGraph\n  commit id: "Alpha" type: HIGHLIGHT\n  branch develop\n  merge develop tag: "v1"');
  expect(tokens[1]).toEqual(["keyword:commit", "identifier:id", "operator::", 'string:"Alpha"', "identifier:type", "operator::", "keyword:HIGHLIGHT"]);
  expect(tokens[2]).toEqual(["keyword:branch", "identifier:develop"]);
  expect(tokens[3]).toEqual(["keyword:merge", "identifier:develop", "identifier:tag", "operator::", 'string:"v1"']);
});

test("returns no tokens for types the Mermaid package already highlights", () => {
  expect(tokenizeDiagram("flowchart TD\nA-->B")).toEqual([]);
  expect(tokenizeDiagram("pie\n\"a\" : 1")).toEqual([]);
});
