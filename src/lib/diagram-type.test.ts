import { expect, test } from "bun:test";
import { detectDiagramKind } from "./diagram-type";

test("detects common diagram keywords", () => {
  expect(detectDiagramKind("flowchart TD\nA-->B")).toBe("flowchart");
  expect(detectDiagramKind("graph LR\nA-->B")).toBe("flowchart");
  expect(detectDiagramKind("pie title X\n\"a\": 1")).toBe("pie");
  expect(detectDiagramKind("sequenceDiagram\nA->>B: hi")).toBe("sequence");
  expect(detectDiagramKind("stateDiagram-v2\n[*] --> A")).toBe("state");
});

test("skips front matter, blank lines and comments", () => {
  expect(detectDiagramKind("---\ntitle: x\n---\n\n%% note\n%%{init: {}}%%\nflowchart TD")).toBe("flowchart");
});

test("reports empty and unknown input", () => {
  expect(detectDiagramKind("  \n%% only a comment")).toBe("empty");
  expect(detectDiagramKind("sankey-beta\na,b,1")).toBe("other");
});
