import { parseClassDiagram, type ClassEntry } from "@/lib/class-diagram";
import { escapeRegExp } from "@/lib/line-model";
import { graphFocus, pairText } from "./graph";
import { entryItems } from "./lines";
import type { FocusAdapter, FocusItem } from "./types";

/** The code an entry was read from. A class with members covers several lines. */
const sourceOf = (entry: ClassEntry): string => (entry.type === "raw" ? entry.text : (entry.origin?.raw ?? ""));

/** Mermaid draws `Shape~T~` (a generic class) as `Shape`. */
const bare = (name: string): string => name.replace(/~[^~]*~$/, "");

/** Mermaid draws a class as `g.node#<svg>-classId-<Name>-<n>`. */
const CLASS_ID = /-classId-(.+)-\d+$/;

/** A relation is drawn as `path.relation[data-id=id_<From>_<To>_<n>]`. The n-th relation of a pair has the n-th such path. */
const relationId = (from: string, to: string): RegExp => new RegExp(`^id_${escapeRegExp(from)}_${escapeRegExp(to)}_\\d+$`);

const { locate, pick } = graphFocus({
  boxKind: "class",
  lineKind: "relation",
  boxSelector: "g.node[id*='-classId-']",
  boxName: (element) => CLASS_ID.exec(element.id)?.[1] ?? null,
  linePathSelector: "path.relation",
  lineId: relationId,
});

/**
 * Items are keyed by the index of their entry. The panel rows use the same index.
 * A class is one item with all its lines. Its members have no item of their own: they focus the class.
 */
export const classFocus: FocusAdapter = {
  items(code) {
    const model = parseClassDiagram(code);
    if (!model) return [];
    return entryItems(code, model.entries, sourceOf, (entry, index) => (entry.type === "raw" ? null : String(index))).map((item): FocusItem => {
      const entry = model.entries[Number(item.key)];
      return entry?.type === "relation" ? { ...item, kind: "relation", text: pairText(bare(entry.from), bare(entry.to)) } : { ...item, kind: "class", text: entry?.type === "class" ? bare(entry.name) : "" };
    });
  },
  locate,
  pick,
};
