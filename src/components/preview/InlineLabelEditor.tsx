import { useEffect, useRef } from "react";

interface Props {
  /** Position of the element being renamed, relative to the canvas. */
  rect: DOMRect;
  initialValue: string;
  onCommit(text: string): void;
  onCancel(): void;
}

/** A text box laid over a diagram element. Enter saves, Shift+Enter adds a line, Escape cancels. */
export function InlineLabelEditor({ rect, initialValue, onCommit, onCancel }: Props) {
  const field = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    if (commit) onCommit(field.current?.value ?? initialValue);
    else onCancel();
  };

  const width = Math.max(160, rect.width + 24);
  const height = Math.max(36, rect.height);
  return (
    <textarea
      ref={field}
      defaultValue={initialValue}
      rows={1}
      aria-label="Label"
      data-testid="inline-editor"
      className="border-primary bg-popover text-popover-foreground absolute z-20 resize-none rounded-md border-2 px-2 py-1.5 text-center text-sm shadow-lg outline-none"
      style={{ left: rect.left + rect.width / 2 - width / 2, top: rect.top + rect.height / 2 - height / 2, width, height }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          finish(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
      }}
    />
  );
}
