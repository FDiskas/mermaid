import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FlowModel, Selection } from "@/lib/flowchart/model";
import type { DiagramKind } from "@/lib/diagram-type";
import { useTranslate } from "@/lib/i18n";
import type { FocusState } from "@/lib/focus";
import { FlowInspector } from "./FlowInspector";
import { FocusContext } from "./focus";
import { VISUAL_EDITORS } from "./visual-editors";

interface Props {
  kind: DiagramKind;
  flow: FlowModel | null;
  /** The code of the diagram, for the model-based panels. */
  code: string;
  selection: Selection;
  /** All selected elements (more than one after a Shift-click). */
  selected: NonNullable<Selection>[];
  hasError: boolean;
  /** The width of the panel in pixels on wide screens. */
  width: number;
  /** The last edit in a panel would have made the diagram invalid, so it was not applied. */
  editRejected: boolean;
  focusToken: number;
  /** The item in focus, for the diagram types that mark items (see `lib/focus`). */
  focus: FocusState | null;
  onFocus(key: string): void;
  onFlowChange(model: FlowModel, nextSelection?: Selection): void;
  /** `check` asks Mermaid to confirm the new code before it replaces the old one. */
  onCodeChange(code: string, options?: { check?: boolean }): void;
  onStartConnect(sourceId: string): void;
  renderedColors(selection: NonNullable<Selection>): { fill?: string; stroke?: string; color?: string };
  onClose(): void;
}

/** The side panel of the visual editor. What it shows depends on the diagram type and the selected element. */
export function Inspector(props: Props) {
  const t = useTranslate();
  const { kind, flow, hasError } = props;
  const visual = VISUAL_EDITORS[kind];

  let body;
  if (kind === "flowchart" && flow) {
    body = <FlowInspector model={flow} selection={props.selection} selected={props.selected} onChange={props.onFlowChange} onStartConnect={props.onStartConnect} renderedColors={props.renderedColors} focusToken={props.focusToken} />;
  } else if (visual) {
    // A diagram that is already invalid cannot get worse, and the user must be able to repair it from the panel.
    const check = visual.checked && !hasError;
    body = visual.render(props.code, (code) => props.onCodeChange(code, { check })) ?? (hasError ? <p className="text-muted-foreground p-4 text-sm">{t.fixSyntaxFirst}</p> : null);
  } else if (kind === "flowchart") {
    body = hasError ? <p className="text-muted-foreground p-4 text-sm">{t.fixSyntaxFirst}</p> : null;
  } else {
    body = <p className="text-muted-foreground p-4 text-sm leading-relaxed">{t.unsupportedVisual}</p>;
  }

  return (
    <aside
      className="bg-card flex w-72 shrink-0 flex-col border-l max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-20 max-md:shadow-xl md:w-(--inspector-width) md:border-l-0"
      style={{ "--inspector-width": `${props.width}px` } as React.CSSProperties}
      data-testid="inspector"
      aria-label={t.visualEditor}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold">{t.visualEditor}</h2>
        <Button variant="ghost" size="icon-sm" onClick={props.onClose} aria-label={t.close} title={t.close}>
          <X />
        </Button>
      </div>
      {props.editRejected && (
        <p role="alert" data-testid="edit-rejected" className="bg-destructive/10 text-destructive border-b px-4 py-2 text-xs">
          {t.editRejected}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <FocusContext.Provider value={{ focus: props.focus, onFocus: props.onFocus }}>{body}</FocusContext.Provider>
      </div>
    </aside>
  );
}
