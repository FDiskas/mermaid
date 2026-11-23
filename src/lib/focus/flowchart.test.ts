import { expect, test } from "bun:test";
import type { FlowEdge, FlowModel } from "@/lib/flowchart/model";
import { flowchartLines, flowchartSelectionAt } from "./flowchart";

const CODE = `flowchart TD
    A[Start] --> B{Ok?}
    B -->|Yes| C
    B -->|No| C
    classDef x fill:#fff
    subgraph G [Group]
      C
    end
`;

const edge = (id: string, from: string, to: string): FlowEdge => ({ id, from, to, label: "", stroke: "normal", head: "arrow", tail: "none", length: 1, styles: [] });
const FLOW: FlowModel = {
  prefix: "",
  keyword: "flowchart",
  direction: "TB",
  nodes: ["A", "B", "C"].map((id) => ({ id, label: id, markdown: false, shape: "square", props: {}, styles: [], classes: [] })),
  edges: [edge("L_A_B_0", "A", "B"), edge("L_B_C_0", "B", "C"), edge("L_B_C_1", "B", "C")],
  groups: [{ id: "G", title: "Group", children: ["C"], classes: [] }],
  classDefs: [],
};

test("a node is where its id is written", () => {
  expect(flowchartLines(CODE, FLOW, { kind: "node", id: "B" })).toEqual([1, 2, 3]);
});

test("the n-th arrow between two nodes is on the n-th line that writes both", () => {
  expect(flowchartLines(CODE, FLOW, { kind: "edge", id: "L_B_C_0" })).toEqual([2]);
  expect(flowchartLines(CODE, FLOW, { kind: "edge", id: "L_B_C_1" })).toEqual([3]);
});

test("a group is its subgraph line", () => {
  expect(flowchartLines(CODE, FLOW, { kind: "group", id: "G" })).toEqual([5]);
});

test("the cursor on an id selects the node, between the ids it selects the arrow", () => {
  expect(flowchartSelectionAt(CODE, FLOW, 1, 4)).toEqual({ kind: "node", id: "A" });
  expect(flowchartSelectionAt(CODE, FLOW, 1, 14)).toEqual({ kind: "edge", id: "L_A_B_0" });
  expect(flowchartSelectionAt(CODE, FLOW, 4, 6)).toBeNull();
});
