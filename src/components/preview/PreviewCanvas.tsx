import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Selection } from "@/lib/flowchart/model";
import type { RenderedDiagram } from "@/lib/mermaid-runtime";
import { addEdgeHitAreas, findTargetElement, labelRectOf, targetFromElement } from "@/lib/svg-targets";
import { cn } from "@/lib/utils";
import { InlineLabelEditor } from "./InlineLabelEditor";

export interface PreviewCanvasHandle {
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  /** The live element drawn for a flowchart element (for reading its colours). */
  elementFor(selection: NonNullable<Selection>): Element | null;
}

interface View {
  x: number;
  y: number;
  k: number;
}

interface Props {
  diagram: RenderedDiagram | null;
  emptyMessage: string;
  /** The visual editor is active: elements can be clicked, selected and renamed. */
  editable: boolean;
  /** Every selected element. More than one when the user Shift-clicked. */
  selected: NonNullable<Selection>[];
  /** Node picked as the start of a new arrow. */
  connectSource: string | null;
  connecting: boolean;
  /** Changing this value refits the diagram to the canvas. */
  fitToken: number;
  dimmed?: boolean;
  /** `additive`: Shift, Ctrl or Cmd was held, so the click adds to or removes from the selection. */
  onSelect(selection: Selection, additive: boolean): void;
  getLabel(selection: NonNullable<Selection>): string | undefined;
  onCommitLabel(selection: NonNullable<Selection>, text: string): void;
  onScaleChange(scale: number): void;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const PAN_THRESHOLD = 4;
const FIT_PADDING = 48;
const FIT_TOP = 72; // room for the floating toolbar

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const PreviewCanvas = forwardRef<PreviewCanvasHandle, Props>(function PreviewCanvas(props, ref) {
  const { diagram, emptyMessage, editable, selected, connectSource, connecting, fitToken, dimmed, onSelect, getLabel, onCommitLabel, onScaleChange } = props;
  const container = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const needsFit = useRef(true);
  const panned = useRef(false);
  const [editing, setEditing] = useState<{ target: NonNullable<Selection>; rect: DOMRect; text: string } | null>(null);

  const applyView = useCallback(
    (next: View) => {
      setView(next);
      onScaleChange(next.k);
    },
    [onScaleChange],
  );

  /** Fits the diagram to the canvas. Returns false when the canvas has no size yet (e.g. its tab is hidden). */
  const fit = useCallback((): boolean => {
    const box = container.current;
    if (!box || !diagram) return false;
    const { width, height } = box.getBoundingClientRect();
    if (width === 0 || height === 0) return false;
    const availableHeight = height - FIT_TOP - FIT_PADDING;
    const k = clamp(Math.min((width - FIT_PADDING * 2) / diagram.width, availableHeight / diagram.height, 1.25), MIN_SCALE, MAX_SCALE);
    applyView({ k, x: (width - diagram.width * k) / 2, y: FIT_TOP + (availableHeight - diagram.height * k) / 2 });
    return true;
  }, [diagram, applyView]);

  const zoomAround = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      const box = container.current;
      if (!box) return;
      const rect = box.getBoundingClientRect();
      const px = cx ?? rect.width / 2;
      const py = cy ?? rect.height / 2;
      const current = viewRef.current;
      const k = clamp(current.k * factor, MIN_SCALE, MAX_SCALE);
      const ratio = k / current.k;
      applyView({ k, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio });
    },
    [applyView],
  );

  useImperativeHandle(ref, () => ({
    zoomIn: () => zoomAround(1.2),
    zoomOut: () => zoomAround(1 / 1.2),
    fit,
    elementFor: (target) => {
      const root = content.current?.querySelector("svg");
      return root ? findTargetElement(root, target) : null;
    },
  }));

  // Fit on the first render, and whenever the parent asks for it (new template, restored version, …).
  useEffect(() => {
    needsFit.current = true;
  }, [fitToken]);
  useLayoutEffect(() => {
    if (diagram && needsFit.current && fit()) needsFit.current = false;
  }, [diagram, fit, fitToken]);

  // A fit that had to wait for the canvas to get a size (hidden tab, panel resize) happens once it has one.
  useEffect(() => {
    const box = container.current;
    if (!box) return;
    const observer = new ResizeObserver(() => {
      if (needsFit.current && fit()) needsFit.current = false;
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [fit]);

  // Wheel: Ctrl/Cmd (and trackpad pinch) zooms at the pointer, plain scrolling pans.
  useEffect(() => {
    const box = container.current;
    if (!box) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = box.getBoundingClientRect();
        zoomAround(Math.exp(-event.deltaY * 0.01), event.clientX - rect.left, event.clientY - rect.top);
      } else {
        const current = viewRef.current;
        applyView({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY });
      }
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [zoomAround, applyView]);

  // Decorate the freshly injected SVG: wide hit areas on arrows.
  useLayoutEffect(() => {
    const root = content.current?.querySelector("svg");
    if (root && editable) addEdgeHitAreas(root);
  }, [diagram, editable]);

  // Highlight the selected element and the arrow's start node.
  useLayoutEffect(() => {
    const root = content.current?.querySelector("svg");
    if (!root) return;
    root.querySelectorAll(".mv-selected, .mv-connect-source").forEach((el) => el.classList.remove("mv-selected", "mv-connect-source"));
    if (!editable) return;
    for (const item of selected) findTargetElement(root, item)?.classList.add("mv-selected");
    if (connectSource) findTargetElement(root, { kind: "node", id: connectSource })?.classList.add("mv-connect-source");
  }, [diagram, selected, connectSource, editable]);

  const drag = useRef<{ x: number; y: number; view: View; pointerId: number } | null>(null);

  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0 || editing) return;
    panned.current = false;
    drag.current = { x: event.clientX, y: event.clientY, view: viewRef.current, pointerId: event.pointerId };
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!panned.current) {
      if (Math.hypot(dx, dy) < PAN_THRESHOLD) return;
      panned.current = true;
      container.current?.setPointerCapture(start.pointerId);
    }
    applyView({ ...start.view, x: start.view.x + dx, y: start.view.y + dy });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const onClick = (event: React.MouseEvent) => {
    if (panned.current) {
      panned.current = false;
      return;
    }
    if (!editable) return;
    onSelect(targetFromElement(event.target as Element), event.shiftKey || event.metaKey || event.ctrlKey);
  };

  const onDoubleClick = (event: React.MouseEvent) => {
    if (!editable) return;
    const target = targetFromElement(event.target as Element);
    const root = content.current?.querySelector("svg");
    const box = container.current;
    if (!target || !root || !box) return;
    const text = getLabel(target);
    const rect = labelRectOf(root, target);
    if (text === undefined || !rect) return;
    const origin = box.getBoundingClientRect();
    setEditing({ target, text, rect: new DOMRect(rect.left - origin.left, rect.top - origin.top, rect.width, rect.height) });
  };

  const markup = useMemo(() => ({ __html: diagram?.svg ?? "" }), [diagram]);

  return (
    <div
      ref={container}
      className={cn(
        "canvas-surface relative h-full w-full touch-none overflow-hidden select-none",
        editable && "mv-editable",
        connecting && "mv-connecting",
        "cursor-grab active:cursor-grabbing",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      data-testid="preview-canvas"
    >
      {diagram ? (
        <div
          ref={content}
          data-testid="diagram"
          className={cn("absolute top-0 left-0 origin-top-left transition-opacity", dimmed && "opacity-40")}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: diagram.width, height: diagram.height }}
          dangerouslySetInnerHTML={markup}
        />
      ) : (
        <div className="text-muted-foreground absolute inset-0 grid place-items-center p-8 text-center text-sm">{emptyMessage}</div>
      )}
      {editing && (
        <InlineLabelEditor
          rect={editing.rect}
          initialValue={editing.text}
          onCommit={(text) => {
            onCommitLabel(editing.target, text);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
});
