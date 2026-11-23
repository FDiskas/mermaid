import { createContext, useContext, useEffect, useRef, type ComponentPropsWithoutRef, type ElementType } from "react";
import type { FocusState } from "@/lib/focus";
import { cn } from "@/lib/utils";

interface FocusContextValue {
  focus: FocusState | null;
  /** The user touched the row with this key. */
  onFocus(key: string): void;
}

export const FocusContext = createContext<FocusContextValue>({ focus: null, onFocus: () => {} });

type FocusRowProps<Tag extends ElementType> = { as?: Tag; focusKey: string } & Omit<ComponentPropsWithoutRef<Tag>, "as">;

/**
 * A row of a panel that stands for one item of the diagram. It is marked while the item is in focus
 * (from the code or the preview too), and it puts the item in focus when the user clicks or tabs into it.
 */
export function FocusRow<Tag extends ElementType = "li">({ as, focusKey, className, children, ...rest }: FocusRowProps<Tag>) {
  const Component: ElementType = as ?? "li";
  const { focus, onFocus } = useContext(FocusContext);
  const focused = focus?.key === focusKey;
  const element = useRef<HTMLElement>(null);

  // Bring the row into view when the focus came from the code or the preview.
  useEffect(() => {
    if (focused && focus?.source !== "panel") element.current?.scrollIntoView({ block: "nearest" });
  }, [focused, focus?.source]);

  return (
    <Component
      ref={element}
      data-focus-key={focusKey}
      data-focused={focused || undefined}
      onFocusCapture={() => onFocus(focusKey)}
      onClick={() => onFocus(focusKey)}
      className={cn("data-[focused]:ring-primary data-[focused]:bg-primary/10 data-[focused]:ring-2", className)}
      {...rest}
    >
      {children}
    </Component>
  );
}
