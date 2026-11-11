import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FlowModel, Selection } from "@/lib/flowchart/model";
import type { DiagramKind } from "@/lib/diagram-type";
import { useTranslate } from "@/lib/i18n";
import type { PieModel } from "@/lib/pie";
import { FlowInspector } from "./FlowInspector";
import { PieInspector } from "./PieInspector";

interface Props {
  kind: DiagramKind;
  flow: FlowModel | null;
  pie: PieModel | null;
  selection: Selection;
  /** All selected elements (more than one after a Shift-click). */
  selected: NonNullable<Selection>[];
  hasError: boolean;
  focusToken: number;
  onFlowChange(model: FlowModel, nextSelection?: Selection): void;
  onPieChange(model: PieModel): void;
  onStartConnect(sourceId: string): void;
  renderedColors(selection: NonNullable<Selection>): { fill?: string; stroke?: string; color?: string };
  onClose(): void;
}

/** The side panel of the visual editor. What it shows depends on the diagram type and the selected element. */
export function Inspector(props: Props) {
  const t = useTranslate();
  const { kind, flow, pie, hasError } = props;

  let body;
  if (kind === "flowchart" && flow) {
    body = <FlowInspector model={flow} selection={props.selection} selected={props.selected} onChange={props.onFlowChange} onStartConnect={props.onStartConnect} renderedColors={props.renderedColors} focusToken={props.focusToken} />;
  } else if (kind === "pie" && pie) {
    body = <PieInspector model={pie} onChange={props.onPieChange} />;
  } else if (hasError && (kind === "flowchart" || kind === "pie")) {
    body = <p className="text-muted-foreground p-4 text-sm">{t.fixSyntaxFirst}</p>;
  } else if (kind === "flowchart" || kind === "pie") {
    body = null;
  } else {
    body = <p className="text-muted-foreground p-4 text-sm leading-relaxed">{t.unsupportedVisual}</p>;
  }

  return (
    <aside className="bg-card flex w-72 shrink-0 flex-col border-l max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-20 max-md:shadow-xl" data-testid="inspector" aria-label={t.visualEditor}>
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold">{t.visualEditor}</h2>
        <Button variant="ghost" size="icon-sm" onClick={props.onClose} aria-label={t.close} title={t.close}>
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
    </aside>
  );
}
