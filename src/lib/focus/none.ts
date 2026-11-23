import type { FocusAdapter } from "./types";

/** An adapter with no items. Stands in for a diagram type that cannot mark its items yet. */
export const noFocus: FocusAdapter = {
  items: () => [],
  locate: () => [],
  pick: () => null,
};
