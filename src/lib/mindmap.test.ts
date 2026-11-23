import { expect, test } from "bun:test";
import { changeNode, newMindNode, parseMindmap, serializeMindmap } from "./mindmap";

const SAMPLE = `mindmap
  root((mindmap))
    Origins
      Long history
      ::icon(fa fa-book)
      Popularisation
    Tools
      Pen and paper
`;

test("parses the tree from indentation", () => {
  const model = parseMindmap(SAMPLE)!;
  expect(model.roots).toHaveLength(1);
  const root = model.roots[0]!;
  expect(root.text).toBe("root((mindmap))");
  expect(root.children.map((c) => c.text)).toEqual(["Origins", "Tools"]);
  expect(root.children[0]!.children.map((c) => c.text)).toEqual(["Long history", "Popularisation"]);
  expect(root.children[0]!.children[0]!.decorations).toEqual(["::icon(fa fa-book)"]);
});

test("round-trips", () => {
  expect(serializeMindmap(parseMindmap(SAMPLE)!)).toBe(SAMPLE);
});

test("understands tabs and uneven indentation", () => {
  const model = parseMindmap("mindmap\n\troot\n\t\tA\n\t\t\t\tdeep\n\t\tB\n")!;
  const root = model.roots[0]!;
  expect(root.children.map((c) => c.text)).toEqual(["A", "B"]);
  expect(root.children[0]!.children[0]!.text).toBe("deep");
});

test("keeps comments and the prefix", () => {
  const model = parseMindmap("---\ntitle: x\n---\nmindmap\n  %% note\n  root\n")!;
  expect(model.prefix).toBe("---\ntitle: x\n---");
  expect(model.extra).toEqual(["%% note"]);
});

test("changeNode edits, adds a child and removes by path", () => {
  const model = parseMindmap(SAMPLE)!;
  const renamed = changeNode(model.roots, [0, 1], (node) => ({ ...node, text: "Instruments" }));
  expect(renamed[0]!.children[1]!.text).toBe("Instruments");
  expect(model.roots[0]!.children[1]!.text).toBe("Tools");
  const grown = changeNode(model.roots, [0, 0], (node) => ({ ...node, children: [...node.children, newMindNode("New")] }));
  expect(grown[0]!.children[0]!.children.at(-1)!.text).toBe("New");
  const removed = changeNode(model.roots, [0, 0, 0], () => null);
  expect(removed[0]!.children[0]!.children.map((c) => c.text)).toEqual(["Popularisation"]);
});

test("an empty text stays a node", () => {
  const model = parseMindmap(SAMPLE)!;
  model.roots[0]!.children.push(newMindNode(" "));
  expect(parseMindmap(serializeMindmap(model))!.roots[0]!.children).toHaveLength(3);
});

test("returns null for other diagrams", () => {
  expect(parseMindmap("pie\n")).toBeNull();
});
