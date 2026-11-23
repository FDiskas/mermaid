/**
 * "Focus" links the three views of a diagram: the code, the side panel and the preview.
 * One item (a slice, a message, a class, …) is in focus. All three views mark it.
 *
 * Every diagram type that has a panel gives a `FocusAdapter`. The adapter works on the code alone.
 */

/** One thing the user can point at. `key` is the same in the code, the panel and the preview. */
export interface FocusItem {
  /** Unique in one diagram. The panel row of the item uses the same key. */
  key: string;
  /** First and last source line of the item (0-based, both included). */
  from: number;
  to: number;
  /** The text that identifies the item in the SVG (a label, a name). Used to find its elements. */
  text?: string;
  /** What sort of item it is, for diagram types that draw several sorts differently (participant, message, …). */
  kind?: string;
}

export interface FocusAdapter {
  /** The items in the code, in source order. */
  items(code: string): FocusItem[];
  /** The elements of the rendered SVG that draw the item. Empty when the SVG has none for it. */
  locate(root: SVGSVGElement, items: FocusItem[], key: string): Element[];
  /** The key of the item that `target` (an element the user clicked in the SVG) belongs to. */
  pick(root: SVGSVGElement, items: FocusItem[], target: Element): string | null;
}

/** Where the last focus change came from. The view that caused it does not scroll. */
export type FocusSource = "code" | "panel" | "preview";

export interface FocusState {
  key: string;
  source: FocusSource;
}
