import { Cable, MousePointer2, Plus, Redo2, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslate } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  /** Flowchart tools (select / add / connect) are only shown when the visual editor can edit the diagram. */
  editable: boolean;
  connecting: boolean;
  onSelectTool(): void;
  onConnectTool(): void;
  onAddNode(): void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
}

function Tool({ label, active, disabled, onClick, testId, children }: { label: string; active?: boolean; disabled?: boolean; onClick(): void; testId: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick} data-testid={testId} className={cn(active && "bg-accent text-accent-foreground")}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Floating tool palette over the canvas. */
export function CanvasToolbar({ editable, connecting, onSelectTool, onConnectTool, onAddNode, canUndo, canRedo, onUndo, onRedo }: Props) {
  const t = useTranslate();
  return (
    <div className="bg-card/95 absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border p-1 shadow-md backdrop-blur" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      {editable && (
        <>
          <Tool label={t.toolSelect} active={!connecting} onClick={onSelectTool} testId="tool-select">
            <MousePointer2 />
          </Tool>
          <Tool label={t.addNode} onClick={onAddNode} testId="tool-add-node">
            <Plus />
          </Tool>
          <Tool label={t.connect} active={connecting} onClick={onConnectTool} testId="tool-connect">
            <Cable />
          </Tool>
          <Separator orientation="vertical" className="mx-1 h-5" />
        </>
      )}
      <Tool label={t.undo} disabled={!canUndo} onClick={onUndo} testId="undo">
        <Undo2 />
      </Tool>
      <Tool label={t.redo} disabled={!canRedo} onClick={onRedo} testId="redo">
        <Redo2 />
      </Tool>
    </div>
  );
}
