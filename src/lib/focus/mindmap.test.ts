import { expect, test } from "bun:test";
import { mindmapFocus, mindmapNodeKey } from "./mindmap";

test("lists the nodes with their paths and drawn texts", () => {
  const code = `mindmap
  root((Mermaid))
    Diagrams
      Flowchart
    Features
`;
  expect(mindmapFocus.items(code)).toEqual([
    { key: mindmapNodeKey([0]), from: 1, to: 1, text: "Mermaid" },
    { key: mindmapNodeKey([0, 0]), from: 2, to: 2, text: "Diagrams" },
    { key: mindmapNodeKey([0, 0, 0]), from: 3, to: 3, text: "Flowchart" },
    { key: mindmapNodeKey([0, 1]), from: 4, to: 4, text: "Features" },
  ]);
});

test("shows only the text of shaped nodes, keeps decoration lines in the node and skips comments", () => {
  const code = `mindmap
  root
    id1[Boxed text]
    ::icon(fa fa-book)
    %% comment
    id2)Cloud(
      id3{{Hex}}
    "Quoted"
    Line one<br/>line two
`;
  expect(mindmapFocus.items(code).map((item) => [item.key, item.from, item.to, item.text])).toEqual([
    [mindmapNodeKey([0]), 1, 1, "root"],
    [mindmapNodeKey([0, 0]), 2, 3, "Boxed text"],
    [mindmapNodeKey([0, 1]), 5, 5, "Cloud"],
    [mindmapNodeKey([0, 1, 0]), 6, 6, "Hex"],
    [mindmapNodeKey([0, 2]), 7, 7, "Quoted"],
    [mindmapNodeKey([0, 3]), 8, 8, "Line one line two"],
  ]);
});

test("a node after a deeper branch goes back to its own level", () => {
  const code = "mindmap\n  a\n    b\n      c\n    d\n  e\n";
  expect(mindmapFocus.items(code).map((item) => item.key)).toEqual(["node:0", "node:0.0", "node:0.0.0", "node:0.1", "node:1"]);
});

test("gives no items for other diagrams", () => {
  expect(mindmapFocus.items("timeline\n  2002 : A\n")).toEqual([]);
});
