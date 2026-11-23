import { expect, test } from "bun:test";
import { addClass, addRelation, canMove, canRename, classNames, parseClassDiagram, removeEntry, renameClass, serializeClassDiagram, updateClass, updateRelation } from "./class-diagram";

const SAMPLE = `classDiagram
    direction RL
    class Animal {
      +String name
      +eat() void
    }
    class Dog
    class Cat {
        <<abstract>>
        +meow() void
    }
    Animal <|-- Dog
    Animal "1" --> "*" Cat : owns
    Cat : +extra
    note for Dog "friendly"
`;

test("writes the code unchanged when nothing was edited", () => {
  expect(serializeClassDiagram(parseClassDiagram(SAMPLE)!)).toBe(SAMPLE);
});

test("understands classes and relations and keeps the rest as raw lines", () => {
  const model = parseClassDiagram(SAMPLE)!;
  expect(model.entries.map((entry) => entry.type)).toEqual(["raw", "class", "class", "class", "relation", "relation", "raw", "raw"]);
  expect(model.entries[1]).toMatchObject({ name: "Animal", members: ["+String name", "+eat() void"] });
  expect(model.entries[3]).toMatchObject({ name: "Cat", members: ["<<abstract>>", "+meow() void"] });
  expect(model.entries[5]).toMatchObject({ from: "Animal", fromCardinality: "1", arrow: "-->", toCardinality: "*", to: "Cat", label: "owns" });
  expect(classNames(model)).toEqual(["Animal", "Dog", "Cat"]);
});

test("an edited block is written with the indent of the class", () => {
  const model = updateClass(parseClassDiagram(SAMPLE)!, 1, { members: ["+String name", "+age int"] });
  expect(serializeClassDiagram(model)).toContain("    class Animal {\n        +String name\n        +age int\n    }\n");
});

test("a class without members is written on one line, and a first member makes a block", () => {
  let model = updateClass(parseClassDiagram(SAMPLE)!, 1, { members: [] });
  expect(serializeClassDiagram(model)).toContain("    class Animal\n    class Dog");
  model = updateClass(parseClassDiagram(SAMPLE)!, 2, { members: ["+bark() void"] });
  expect(serializeClassDiagram(model)).toContain("    class Dog {\n        +bark() void\n    }");
});

test("an unclosed or nested block stays raw", () => {
  const code = "classDiagram\n    class A {\n      +x\n    class B\n";
  expect(parseClassDiagram(code)!.entries.map((entry) => entry.type)).toEqual(["raw", "raw", "class"]);
  const nested = "classDiagram\n    class A {\n      +x {\n    }\n";
  expect(parseClassDiagram(nested)!.entries[0]).toMatchObject({ type: "raw" });
});

test("edits a relation", () => {
  const model = updateRelation(parseClassDiagram(SAMPLE)!, 5, { arrow: "..>", fromCardinality: "", label: "" });
  expect(serializeClassDiagram(model)).toContain('    Animal ..> "*" Cat\n');
});

test("a class can be renamed only while nothing else mentions it", () => {
  const model = parseClassDiagram(SAMPLE)!;
  expect(canRename(model, 1)).toBe(false); // used in a relation
  expect(canRename(model, 2)).toBe(false); // used in a relation and a note
  const added = addClass(model, "Class");
  const index = added.entries.findIndex((entry) => entry.type === "class" && entry.name === "Class");
  expect(canRename(added, index)).toBe(true);
  expect(serializeClassDiagram(renameClass(added, index, "Bird"))).toContain("    class Bird\n");
  expect(renameClass(added, index, "Dog")).toBe(added);
  expect(renameClass(added, index, "has space")).toBe(added);
  expect(renameClass(model, 1, "Beast")).toBe(model);
});

test("adds a class after the last class and a relation at the end", () => {
  const model = addRelation(addClass(parseClassDiagram("classDiagram\n    class A\n    A --> A\n")!, "Class"));
  expect(serializeClassDiagram(model)).toBe("classDiagram\n    class A\n    class Class\n    A --> A\n    A --> Class\n");
});

test("removes a class without touching the relations", () => {
  const code = serializeClassDiagram(removeEntry(parseClassDiagram(SAMPLE)!, 2));
  expect(code).not.toContain("class Dog");
  expect(code).toContain("Animal <|-- Dog");
});

test("classes move only among classes", () => {
  const model = parseClassDiagram(SAMPLE)!;
  expect(canMove(model, 1, 1)).toBe(true);
  expect(canMove(model, 1, -1)).toBe(false);
  expect(canMove(model, 3, 1)).toBe(false);
});

test("keeps the prefix and returns null for other diagrams", () => {
  const code = "---\ntitle: x\n---\nclassDiagram-v2\n    class A\n";
  expect(serializeClassDiagram(parseClassDiagram(code)!)).toBe(code);
  expect(parseClassDiagram("erDiagram\n")).toBeNull();
});
