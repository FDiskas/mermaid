import { describe, expect, test } from "bun:test";
import type { FlowModel } from "./model";
import { addEdge, addNode, duplicateNode, removeEdge, removeNode, reverseEdge, ungroup, updateNode } from "./ops";
import { linkToken, serializeFlowchart } from "./serialize";
import { getStyleProp, setStyleProp, toHexColor } from "./styles";

function base(): FlowModel {
  return {
    prefix: "",
    keyword: "flowchart",
    direction: "TB",
    nodes: [
      { id: "A", label: "Start", markdown: false, shape: "stadium", props: {}, styles: [], classes: [] },
      { id: "B", label: "B", markdown: false, shape: "square", props: {}, styles: ["fill:#f9f"], classes: ["hot"] },
    ],
    edges: [{ id: "L_A_B_0", from: "A", to: "B", label: "go", stroke: "normal", head: "arrow", tail: "none", length: 1, styles: [] }],
    groups: [],
    classDefs: [{ id: "hot", styles: ["stroke:#f00"] }],
  };
}

describe("serializeFlowchart", () => {
  test("writes nodes, edges, classes and styles", () => {
    expect(serializeFlowchart(base())).toBe(
      [
        "flowchart TD",
        '    A(["Start"])',
        "    B",
        '    A -->|"go"| B',
        "    classDef hot stroke:#f00",
        "    class B hot",
        "    style B fill:#f9f",
        "",
      ].join("\n"),
    );
  });

  test("escapes quotes and line breaks in labels", () => {
    const model = updateNode(base(), "A", { label: 'Say "hi"\nthere' });
    expect(serializeFlowchart(model)).toContain('A(["Say #quot;hi#quot;<br/>there"])');
  });

  test("keeps the prefix and writes nested groups", () => {
    const model: FlowModel = {
      ...base(),
      prefix: "%%{init: {}}%%",
      groups: [
        { id: "outer", title: "Outer", children: ["inner", "B"], classes: [] },
        { id: "inner", title: "Inner", children: ["A"], direction: "LR", classes: [] },
      ],
    };
    const text = serializeFlowchart(model);
    expect(text.startsWith("%%{init: {}}%%\nflowchart TD")).toBe(true);
    expect(text).toContain('    subgraph outer["Outer"]\n        subgraph inner["Inner"]\n            direction LR\n            A\n        end\n        B\n    end');
  });

  test("writes unknown shapes with the @{ } syntax", () => {
    const model = updateNode(base(), "B", { shape: "bolt", label: "Zap" });
    expect(serializeFlowchart(model)).toContain('B@{ shape: bolt, label: "Zap" }');
  });
});

describe("linkToken", () => {
  test.each([
    [{ stroke: "normal", head: "arrow", tail: "none", length: 1 }, "-->"],
    [{ stroke: "normal", head: "open", tail: "none", length: 1 }, "---"],
    [{ stroke: "normal", head: "cross", tail: "none", length: 1 }, "--x"],
    [{ stroke: "normal", head: "circle", tail: "none", length: 1 }, "--o"],
    [{ stroke: "normal", head: "arrow", tail: "arrow", length: 1 }, "<-->"],
    [{ stroke: "normal", head: "cross", tail: "cross", length: 1 }, "x--x"],
    [{ stroke: "dotted", head: "arrow", tail: "none", length: 1 }, "-.->"],
    [{ stroke: "dotted", head: "open", tail: "none", length: 2 }, "-..-"],
    [{ stroke: "thick", head: "arrow", tail: "none", length: 1 }, "==>"],
    [{ stroke: "thick", head: "open", tail: "none", length: 1 }, "==="],
    [{ stroke: "normal", head: "arrow", tail: "none", length: 3 }, "---->"],
    [{ stroke: "invisible", head: "open", tail: "none", length: 1 }, "~~~"],
  ] as const)("%o -> %s", (edge, token) => {
    expect(linkToken(edge)).toBe(token);
  });
});

describe("operations", () => {
  test("addNode picks the next free letter and connects it", () => {
    const { model, id } = addNode(base(), { label: "New", connectFrom: "B" });
    expect(id).toBe("C");
    expect(model.edges.map((e) => e.id)).toEqual(["L_A_B_0", "L_B_C_0"]);
  });

  test("addNode joins the group of its sibling", () => {
    const model: FlowModel = { ...base(), groups: [{ id: "g", title: "g", children: ["B"], classes: [] }] };
    expect(addNode(model, { label: "x", siblingOf: "B" }).model.groups[0]!.children).toEqual(["B", "C"]);
  });

  test("removeNode drops its edges and group membership", () => {
    const model: FlowModel = { ...base(), groups: [{ id: "g", title: "g", children: ["A", "B"], classes: [] }] };
    const next = removeNode(model, "A");
    expect(next.nodes.map((n) => n.id)).toEqual(["B"]);
    expect(next.edges).toEqual([]);
    expect(next.groups[0]!.children).toEqual(["B"]);
  });

  test("parallel edges get increasing ids", () => {
    const model = addEdge(addEdge(base(), "A", "B"), "A", "B");
    expect(model.edges.map((e) => e.id)).toEqual(["L_A_B_0", "L_A_B_1", "L_A_B_2"]);
    expect(removeEdge(model, "L_A_B_0").edges.map((e) => e.id)).toEqual(["L_A_B_0", "L_A_B_1"]);
  });

  test("reverseEdge swaps the ends and returns the new id", () => {
    const { model, id } = reverseEdge(base(), "L_A_B_0");
    expect(model.edges[0]).toMatchObject({ from: "B", to: "A", id: "L_B_A_0" });
    expect(id).toBe("L_B_A_0");
  });

  test("duplicateNode copies style without sharing arrays", () => {
    const { model, id } = duplicateNode(base(), "B");
    const copy = model.nodes.find((n) => n.id === id)!;
    expect(copy.styles).toEqual(["fill:#f9f"]);
    expect(copy.styles).not.toBe(model.nodes[1]!.styles);
  });

  test("ungroup moves children up and removes arrows to the group", () => {
    const model: FlowModel = {
      ...base(),
      edges: [...base().edges, { id: "", from: "A", to: "outer", label: "", stroke: "normal", head: "arrow", tail: "none", length: 1, styles: [] }],
      groups: [
        { id: "outer", title: "o", children: ["inner"], classes: [] },
        { id: "inner", title: "i", children: ["A"], classes: [] },
      ],
    };
    const next = ungroup(model, "inner");
    expect(next.groups).toEqual([{ id: "outer", title: "o", children: ["A"], classes: [] }]);
    expect(ungroup(next, "outer").edges.map((e) => e.to)).toEqual(["B"]);
  });
});

describe("style helpers", () => {
  test("get, set and clear a property", () => {
    const styles = setStyleProp(["fill:#fff", "stroke:#000"], "fill", "#f00");
    expect(getStyleProp(styles, "fill")).toBe("#f00");
    expect(getStyleProp(styles, "stroke")).toBe("#000");
    expect(setStyleProp(styles, "fill", undefined)).toEqual(["stroke:#000"]);
  });

  test("toHexColor handles hex, short hex and rgb()", () => {
    expect(toHexColor("#ABC")).toBe("#aabbcc");
    expect(toHexColor("rgb(255, 0, 16)")).toBe("#ff0010");
    expect(toHexColor("red")).toBeUndefined();
  });
});

describe("arrow ends", () => {
  test("open lines lose the start arrow; both-ends follows the head", async () => {
    const { setEdgeBothEnds, setEdgeHead } = await import("./ops");
    const both = setEdgeBothEnds(base(), "L_A_B_0", true);
    expect(both.edges[0]).toMatchObject({ head: "arrow", tail: "arrow" });
    const cross = setEdgeHead(both, "L_A_B_0", "cross");
    expect(cross.edges[0]).toMatchObject({ head: "cross", tail: "cross" });
    const open = setEdgeHead(cross, "L_A_B_0", "open");
    expect(open.edges[0]).toMatchObject({ head: "open", tail: "none" });
    expect(setEdgeBothEnds(open, "L_A_B_0", true)).toBe(open);
  });
});
