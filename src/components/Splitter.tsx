import { useRef } from "react";

interface Props {
  /** Called with the pointer position as a fraction (0–1) of the parent's width. */
  onChange(fraction: number): void;
}

export function Splitter({ onChange }: Props) {
  const handle = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={handle}
      role="separator"
      aria-orientation="vertical"
      data-testid="splitter"
      className="hover:bg-primary/40 active:bg-primary/60 hidden w-1 shrink-0 cursor-col-resize bg-border transition-colors md:block"
      onPointerDown={(event) => {
        event.preventDefault();
        handle.current?.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!handle.current?.hasPointerCapture(event.pointerId)) return;
        const parent = handle.current.parentElement?.getBoundingClientRect();
        if (parent) onChange((event.clientX - parent.left) / parent.width);
      }}
    />
  );
}
