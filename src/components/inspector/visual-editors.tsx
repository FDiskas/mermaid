import type { ComponentType, ReactNode } from "react";
import type { DiagramKind } from "@/lib/diagram-type";
import { parseGantt, serializeGantt, type GanttModel } from "@/lib/gantt";
import { parseJourney, serializeJourney, type JourneyModel } from "@/lib/journey";
import { parseMindmap, serializeMindmap, type MindmapModel } from "@/lib/mindmap";
import { parsePie, serializePie, type PieModel } from "@/lib/pie";
import { parseQuadrant, serializeQuadrant, type QuadrantModel } from "@/lib/quadrant";
import { parseTimeline, serializeTimeline, type TimelineModel } from "@/lib/timeline";
import { GanttInspector } from "./GanttInspector";
import { JourneyInspector } from "./JourneyInspector";
import { MindmapInspector } from "./MindmapInspector";
import { PieInspector } from "./PieInspector";
import { QuadrantInspector } from "./QuadrantInspector";
import { TimelineInspector } from "./TimelineInspector";

/** What one diagram type needs to be editable in the side panel. */
interface VisualEditorSpec<Model> {
  parse(code: string): Model | null;
  serialize(model: Model): string;
  Panel: ComponentType<{ model: Model; onChange(model: Model): void }>;
}

export interface VisualEditor {
  /** The panel for `code`, or `null` when the code cannot be parsed. `onCode` receives the new code after an edit. */
  render(code: string, onCode: (code: string) => void): ReactNode | null;
}

/** Hides the model type, so editors of different diagram types fit in one registry. */
function defineVisualEditor<Model>({ parse, serialize, Panel }: VisualEditorSpec<Model>): VisualEditor {
  return {
    render(code, onCode) {
      const model = parse(code);
      return model ? <Panel model={model} onChange={(next) => onCode(serialize(next))} /> : null;
    },
  };
}

/** Diagram types edited with a model-based panel. Flowcharts have their own, richer editor. */
export const VISUAL_EDITORS: Partial<Record<DiagramKind, VisualEditor>> = {
  pie: defineVisualEditor<PieModel>({ parse: parsePie, serialize: serializePie, Panel: PieInspector }),
  timeline: defineVisualEditor<TimelineModel>({ parse: parseTimeline, serialize: serializeTimeline, Panel: TimelineInspector }),
  quadrant: defineVisualEditor<QuadrantModel>({ parse: parseQuadrant, serialize: serializeQuadrant, Panel: QuadrantInspector }),
  mindmap: defineVisualEditor<MindmapModel>({ parse: parseMindmap, serialize: serializeMindmap, Panel: MindmapInspector }),
  journey: defineVisualEditor<JourneyModel>({ parse: parseJourney, serialize: serializeJourney, Panel: JourneyInspector }),
  gantt: defineVisualEditor<GanttModel>({ parse: parseGantt, serialize: serializeGantt, Panel: GanttInspector }),
};
