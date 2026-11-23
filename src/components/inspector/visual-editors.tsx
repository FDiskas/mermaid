import type { ComponentType, ReactNode } from "react";
import type { DiagramKind } from "@/lib/diagram-type";
import { parseClassDiagram, serializeClassDiagram, type ClassModel } from "@/lib/class-diagram";
import { parseEr, serializeEr, type ErModel } from "@/lib/er";
import { parseGantt, serializeGantt, type GanttModel } from "@/lib/gantt";
import { parseGitGraph, serializeGitGraph, type GitModel } from "@/lib/git-graph";
import { parseJourney, serializeJourney, type JourneyModel } from "@/lib/journey";
import { parseMindmap, serializeMindmap, type MindmapModel } from "@/lib/mindmap";
import { parsePie, serializePie, type PieModel } from "@/lib/pie";
import { parseQuadrant, serializeQuadrant, type QuadrantModel } from "@/lib/quadrant";
import { parseSequence, serializeSequence, type SequenceModel } from "@/lib/sequence";
import { parseState, serializeState, type StateModel } from "@/lib/state";
import { parseTimeline, serializeTimeline, type TimelineModel } from "@/lib/timeline";
import { ClassInspector } from "./ClassInspector";
import { ErInspector } from "./ErInspector";
import { GanttInspector } from "./GanttInspector";
import { GitInspector } from "./GitInspector";
import { JourneyInspector } from "./JourneyInspector";
import { MindmapInspector } from "./MindmapInspector";
import { PieInspector } from "./PieInspector";
import { QuadrantInspector } from "./QuadrantInspector";
import { SequenceInspector } from "./SequenceInspector";
import { StateInspector } from "./StateInspector";
import { TimelineInspector } from "./TimelineInspector";

/** What one diagram type needs to be editable in the side panel. */
interface VisualEditorSpec<Model> {
  parse(code: string): Model | null;
  serialize(model: Model): string;
  Panel: ComponentType<{ model: Model; onChange(model: Model): void }>;
  /** Ask Mermaid whether an edit is still valid before it is applied. For the line-based editors, whose syntax is large. */
  checked?: boolean;
}

export interface VisualEditor {
  /** The panel for `code`, or `null` when the code cannot be parsed. `onCode` receives the new code after an edit. */
  render(code: string, onCode: (code: string) => void): ReactNode | null;
  /** True when an edit must be checked with Mermaid before it is applied. */
  checked: boolean;
}

/** Hides the model type, so editors of different diagram types fit in one registry. */
function defineVisualEditor<Model>({ parse, serialize, Panel, checked = false }: VisualEditorSpec<Model>): VisualEditor {
  return {
    checked,
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
  sequence: defineVisualEditor<SequenceModel>({ parse: parseSequence, serialize: serializeSequence, Panel: SequenceInspector, checked: true }),
  class: defineVisualEditor<ClassModel>({ parse: parseClassDiagram, serialize: serializeClassDiagram, Panel: ClassInspector, checked: true }),
  state: defineVisualEditor<StateModel>({ parse: parseState, serialize: serializeState, Panel: StateInspector, checked: true }),
  er: defineVisualEditor<ErModel>({ parse: parseEr, serialize: serializeEr, Panel: ErInspector, checked: true }),
  git: defineVisualEditor<GitModel>({ parse: parseGitGraph, serialize: serializeGitGraph, Panel: GitInspector, checked: true }),
};
