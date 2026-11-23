/** Helpers shared by the adapters that find SVG elements by the text they show. */

export const norm = (text: string | null | undefined): string => (text ?? "").replace(/\s+/g, " ").trim();

/** All elements matching `selector` inside `root`, with the text they show. */
export function withText(root: ParentNode, selector: string): { element: Element; text: string }[] {
  return [...root.querySelectorAll(selector)].map((element) => ({ element, text: norm(element.textContent) }));
}

/**
 * The n-th element of `selector` whose text is `text`, where n counts the earlier items that show the same text.
 * `sameTextBefore` is how many items before this one show `text` too.
 */
export function nthWithText(root: ParentNode, selector: string, text: string, sameTextBefore = 0): Element | null {
  return withText(root, selector).filter((candidate) => candidate.text === norm(text))[sameTextBefore]?.element ?? null;
}

/** Counts how many of `texts` before `index` equal `texts[index]`. */
export function occurrenceOf(texts: string[], index: number): number {
  return texts.slice(0, index).filter((text) => text === texts[index]).length;
}
