import { expect, test } from "bun:test";
import { addEntity, addRelationship, canMove, canRename, entityNames, newAttribute, parseEr, removeEntry, renameEntity, serializeEr, updateEntity, updateRelationship } from "./er";

const SAMPLE = `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||..o{ LINE_ITEM : "is in"
    CUSTOMER {
      string name PK
      string email "contact, work"
      varchar(255) note FK, UK
    }
    ORDER {
      int id
    }
    CUSTOMER_ALIAS["Customer alias"] {
      int x
    }
    direction LR
`;

test("writes the code unchanged when nothing was edited", () => {
  expect(serializeEr(parseEr(SAMPLE)!)).toBe(SAMPLE);
});

test("understands relationships and entities and keeps the rest as raw lines", () => {
  const model = parseEr(SAMPLE)!;
  expect(model.entries.map((entry) => entry.type)).toEqual(["relationship", "relationship", "relationship", "entity", "entity", "raw", "raw", "raw", "raw"]);
  expect(model.entries[0]).toMatchObject({ left: "CUSTOMER", leftCardinality: "||", line: "--", rightCardinality: "o{", right: "ORDER", label: "places" });
  expect(model.entries[2]).toMatchObject({ line: "..", label: '"is in"' });
  expect(model.entries[3]).toMatchObject({
    name: "CUSTOMER",
    attributes: [
      { type: "string", name: "name", keys: ["PK"], comment: "" },
      { type: "string", name: "email", keys: [], comment: "contact, work" },
      { type: "varchar(255)", name: "note", keys: ["FK", "UK"], comment: "" },
    ],
  });
  expect(entityNames(model)).toEqual(["CUSTOMER", "ORDER", "LINE_ITEM", "PRODUCT"]);
});

test("a block with a line the editor cannot read stays raw", () => {
  const code = "erDiagram\n    A {\n      string name PK extra words\n    }\n    B {\n      string x {\n    }\n";
  const model = parseEr(code)!;
  expect(model.entries.every((entry) => entry.type === "raw")).toBe(true);
  expect(serializeEr(model)).toBe(code);
});

test("a relationship with a new cardinality is written back", () => {
  const model = updateRelationship(parseEr(SAMPLE)!, 0, { rightCardinality: "|{", line: ".." });
  expect(serializeEr(model)).toContain("    CUSTOMER ||..|{ ORDER : places\n");
});

test("a label with a space is quoted and an empty one stays a label", () => {
  let model = updateRelationship(parseEr(SAMPLE)!, 0, { label: "has many" });
  expect(serializeEr(model)).toContain('ORDER : "has many"');
  model = updateRelationship(parseEr(SAMPLE)!, 0, { label: "" });
  expect(parseEr(serializeEr(model))!.entries[0]).toMatchObject({ type: "relationship", label: "…" });
});

test("edits attributes", () => {
  const model = parseEr(SAMPLE)!;
  const customer = model.entries[3]!;
  if (customer.type !== "entity") throw new Error("expected an entity");
  const next = updateEntity(model, 3, { attributes: [...customer.attributes, { ...newAttribute("age"), type: "int", keys: ["PK", "XX"], comment: 'say "hi"' }] });
  expect(serializeEr(next)).toContain("      int age PK \"say 'hi'\"\n    }");
});

test("an entity without attributes stays an entity block, so the panel still lists it", () => {
  const code = serializeEr(updateEntity(parseEr(SAMPLE)!, 4, { attributes: [] }));
  expect(code).toContain("    ORDER {\n    }\n    CUSTOMER_ALIAS");
  expect(parseEr(code)!.entries[4]).toMatchObject({ type: "entity", attributes: [] });
});

test("an entity can be renamed only while nothing else mentions it", () => {
  const model = parseEr(SAMPLE)!;
  expect(canRename(model, 3)).toBe(false);
  const added = addEntity(model, "ENTITY", "id");
  const index = added.entries.findIndex((entry) => entry.type === "entity" && entry.name === "ENTITY");
  expect(canRename(added, index)).toBe(true);
  expect(serializeEr(renameEntity(added, index, "SHOP"))).toContain("    SHOP {\n        string id\n    }");
  expect(renameEntity(added, index, "ORDER")).toBe(added);
  expect(renameEntity(added, index, "bad name")).toBe(added);
});

test("adds an entity after the last one and a relationship at the end", () => {
  const model = addRelationship(addEntity(parseEr("erDiagram\n    A {\n      int x\n    }\n    A ||--o{ A : self\n")!, "ENTITY", "id"), "has");
  expect(serializeEr(model)).toBe("erDiagram\n    A {\n      int x\n    }\n    ENTITY {\n        string id\n    }\n    A ||--o{ A : self\n    A ||--o{ ENTITY : has\n");
});

test("removes an entity and keeps the relationships", () => {
  const code = serializeEr(removeEntry(parseEr(SAMPLE)!, 3));
  expect(code).not.toContain("string name PK");
  expect(code).toContain("CUSTOMER ||--o{ ORDER");
});

test("relationships move only among relationships", () => {
  const model = parseEr(SAMPLE)!;
  expect(canMove(model, 0, 1)).toBe(true);
  expect(canMove(model, 2, 1)).toBe(false);
  expect(canMove(model, 4, 1)).toBe(false);
});

test("keeps the prefix and returns null for other diagrams", () => {
  const code = "---\ntitle: x\n---\nerDiagram\n    A ||--|| B : is\n";
  expect(serializeEr(parseEr(code)!)).toBe(code);
  expect(parseEr("classDiagram\n")).toBeNull();
});
