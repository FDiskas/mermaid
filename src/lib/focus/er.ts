import { parseEr, type ErEntry } from "@/lib/er";
import { escapeRegExp } from "@/lib/line-model";
import { graphFocus, pairText } from "./graph";
import { entryItems } from "./lines";
import type { FocusAdapter, FocusItem } from "./types";

/** The code an entry was read from. An entity with attributes covers several lines. */
const sourceOf = (entry: ErEntry): string => (entry.type === "raw" ? entry.text : (entry.origin?.raw ?? ""));

/** A name can be written in quotes. Mermaid draws it without them. */
const bare = (name: string): string => name.replace(/^"(.*)"$/, "$1");

/** Mermaid draws an entity as `g.node#<svg>-entity-<NAME>-<n>`. */
const ENTITY_ID = /-entity-(.+)-\d+$/;

/** A relationship is drawn as `path.relationshipLine[data-id=id_entity-<A>-<i>_entity-<B>-<j>_<n>]`. The n-th relationship of a pair has the n-th such path. */
const relationshipId = (left: string, right: string): RegExp => new RegExp(`^id_entity-${escapeRegExp(left)}-\\d+_entity-${escapeRegExp(right)}-\\d+_\\d+$`);

const { locate, pick } = graphFocus({
  boxKind: "entity",
  lineKind: "relationship",
  boxSelector: "g.node[id*='-entity-']",
  boxName: (element) => ENTITY_ID.exec(element.id)?.[1] ?? null,
  linePathSelector: "path.relationshipLine",
  lineId: relationshipId,
});

/**
 * Items are keyed by the index of their entry. The panel rows use the same index.
 * An entity is one item with all its lines. Its attributes have no item of their own: they focus the entity.
 */
export const erFocus: FocusAdapter = {
  items(code) {
    const model = parseEr(code);
    if (!model) return [];
    return entryItems(code, model.entries, sourceOf, (entry, index) => (entry.type === "raw" ? null : String(index))).map((item): FocusItem => {
      const entry = model.entries[Number(item.key)];
      return entry?.type === "relationship"
        ? { ...item, kind: "relationship", text: pairText(bare(entry.left), bare(entry.right)) }
        : { ...item, kind: "entity", text: entry?.type === "entity" ? bare(entry.name) : "" };
    });
  },
  locate,
  pick,
};
