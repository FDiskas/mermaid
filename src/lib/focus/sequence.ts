import { parseSequence, type SequenceEntry } from "@/lib/sequence";
import { norm } from "./dom";
import { entryItems } from "./lines";
import type { FocusAdapter, FocusItem } from "./types";

type Kind = "participant" | "message" | "note";

/** The text each kind of item draws, as the selector of the element that holds it. */
const TEXT_SELECTOR: Record<Kind, string> = { participant: "text.actor-box", message: "text.messageText", note: "text.noteText" };
const ANY_TEXT = Object.values(TEXT_SELECTOR).join(", ");

/** The code an entry was read from. */
const sourceOf = (entry: SequenceEntry): string => (entry.type === "raw" ? entry.text : (entry.origin?.raw ?? ""));

function textOf(entry: SequenceEntry): string {
  if (entry.type === "raw") return "";
  return norm(entry.type === "participant" ? entry.label || entry.id : entry.text);
}

/** The element with the text of the clicked thing: the text itself, the box it sits in, or the text a message line belongs to. */
function textElementAt(target: Element): Element | null {
  const own = target.closest(ANY_TEXT);
  if (own) return own;
  const sibling = target.closest("g")?.querySelector(":scope > text.actor-box, :scope > text.noteText");
  if (sibling) return sibling;
  const previous = target.previousElementSibling;
  return /messageLine/.test(target.getAttribute("class") ?? "") && previous?.matches("text.messageText") ? previous : null;
}

const kindOfText = (element: Element): Kind => (element.matches(TEXT_SELECTOR.participant) ? "participant" : element.matches(TEXT_SELECTOR.message) ? "message" : "note");

/** The elements of the kind that show `text`, in drawing order. */
const drawn = (root: SVGSVGElement, kind: Kind, text: string): Element[] => [...root.querySelectorAll(TEXT_SELECTOR[kind])].filter((element) => norm(element.textContent) === text);

/** Items are keyed by the index of their entry. The panel rows use the same index. */
export const sequenceFocus: FocusAdapter = {
  items(code) {
    const model = parseSequence(code);
    if (!model) return [];
    return entryItems(code, model.entries, sourceOf, (entry, index) => (entry.type === "raw" ? null : String(index))).map((item): FocusItem => {
      const entry = model.entries[Number(item.key)] as SequenceEntry;
      return { ...item, kind: entry.type, text: textOf(entry) };
    });
  },

  locate(root, items, key) {
    const item = items.find((candidate) => candidate.key === key);
    if (!item) return [];
    const kind = item.kind as Kind;
    const candidates = drawn(root, kind, item.text ?? "");
    // A participant is drawn twice (top and bottom). Other items that look alike are drawn once each: this is the n-th of them.
    if (kind === "participant") return candidates.map((element) => element.parentElement ?? element);
    const rank = items.filter((other) => other.kind === kind && other.text === item.text).indexOf(item);
    const text = candidates[rank];
    if (!text) return [];
    if (kind === "note") return [text.parentElement ?? text];
    const line = text.nextElementSibling;
    return line && /messageLine/.test(line.getAttribute("class") ?? "") ? [text, line] : [text];
  },

  pick(root, items, target) {
    const text = textElementAt(target);
    if (!text) return null;
    const kind = kindOfText(text);
    const label = norm(text.textContent);
    const rank = kind === "participant" ? 0 : drawn(root, kind, label).indexOf(text);
    return items.filter((item) => item.kind === kind && item.text === label)[rank]?.key ?? null;
  },
};
