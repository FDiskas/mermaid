import type { DiagramKind } from "@/lib/diagram-type";
import { classFocus } from "./class";
import { erFocus } from "./er";
import { ganttFocus } from "./gantt";
import { gitFocus } from "./git";
import { journeyFocus } from "./journey";
import { mindmapFocus } from "./mindmap";
import { pieFocus } from "./pie";
import { quadrantFocus } from "./quadrant";
import { sequenceFocus } from "./sequence";
import { stateFocus } from "./state";
import { timelineFocus } from "./timeline";
import type { FocusAdapter } from "./types";

export type { FocusAdapter, FocusItem, FocusSource, FocusState } from "./types";
export { itemAtLine, itemByKey } from "./lines";

/** Diagram types that mark the focused item. Flowcharts use their own selection (`flowchart.ts`). */
export const FOCUS_ADAPTERS: Partial<Record<DiagramKind, FocusAdapter>> = {
  pie: pieFocus,
  timeline: timelineFocus,
  quadrant: quadrantFocus,
  mindmap: mindmapFocus,
  journey: journeyFocus,
  gantt: ganttFocus,
  sequence: sequenceFocus,
  class: classFocus,
  state: stateFocus,
  er: erFocus,
  git: gitFocus,
};
