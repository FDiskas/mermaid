import { useRef } from "react";

interface Props {
  /** Called while the handle is dragged, with the pointer's x position and the bounds of the parent element. */
  onChange(clientX: number, parentBounds: DOMRect): void;
  testId?: string;
}

export function Splitter({ onChange, testId = "splitter" }: Props) {
  const handle = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={handle}
      role="separator"
      aria-orientation="vertical"
      data-testid={testId}
      className="hover:bg-primary/40 active:bg-primary/60 hidden w-1 shrink-0 cursor-col-resize bg-border transition-colors md:block"
      onPointerDown={(event) => {
        event.preventDefault();
        handle.current?.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!handle.current?.hasPointerCapture(event.pointerId)) return;
        const parent = handle.current.parentElement?.getBoundingClientRect();
        if (parent) onChange(event.clientX, parent);
      }}
    />
  );
}
