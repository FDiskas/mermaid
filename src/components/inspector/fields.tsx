import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function Section({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3 border-b px-4 py-4 last:border-b-0", className)}>
      {title && <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{title}</h3>}
      {children}
    </section>
  );
}

export function Field({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-muted-foreground block text-xs font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

interface CommitFieldProps {
  value: string;
  onCommit(value: string): void;
  multiline?: boolean;
  id?: string;
  type?: string;
  className?: string;
  /** Changing this value focuses and selects the field. */
  focusToken?: number;
  inputMode?: "text" | "decimal";
  /** Step of a number field. */
  step?: string;
  /** Accessible name for a field that has no visible label. */
  ariaLabel?: string;
  /** Hint shown in an empty field. */
  placeholder?: string;
}

/**
 * A text field that reports every edit, but ignores incoming prop changes while it has focus.
 * This stops the value being rewritten under the cursor when the diagram is re-parsed.
 */
export function CommitField({ value, onCommit, multiline, id, type, className, focusToken, inputMode, step, ariaLabel, placeholder }: CommitFieldProps) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  const element = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  useEffect(() => {
    if (focusToken) {
      element.current?.focus();
      element.current?.select();
    }
  }, [focusToken]);

  const shared = {
    id,
    "aria-label": ariaLabel,
    placeholder,
    value: draft,
    onFocus: () => (focused.current = true),
    onBlur: () => {
      focused.current = false;
      setDraft(value);
    },
    onChange: (event: { target: { value: string } }) => {
      setDraft(event.target.value);
      onCommit(event.target.value);
    },
  };

  return multiline ? (
    <Textarea ref={element} rows={2} className={cn("min-h-0 resize-y text-sm", className)} {...shared} />
  ) : (
    <Input ref={element} type={type} inputMode={inputMode} step={step} className={cn("h-8 text-sm", className)} {...shared} />
  );
}

interface ColorFieldProps {
  label: string;
  /** Colour set by the user, if any. */
  value: string | undefined;
  /** Colour shown when nothing is set (what Mermaid drew). */
  fallback: string;
  presets?: string[];
  onChange(color: string): void;
  onClear(): void;
}

export function ColorField({ label, value, fallback, presets, onChange, onClear }: ColorFieldProps) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value ?? fallback}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          className="border-input h-8 w-10 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
        />
        <span className="text-muted-foreground font-mono text-xs">{value ? value : "auto"}</span>
        {value && (
          <button type="button" onClick={onClear} aria-label={`${label}: auto`} className="text-muted-foreground hover:text-foreground ml-auto px-1 text-sm">
            ×
          </button>
        )}
      </div>
      {presets && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {presets.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              title={color}
              onClick={() => onChange(color)}
              className="border-border size-5 rounded-full border transition-transform hover:scale-110"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}
    </Field>
  );
}

export function DeleteButton({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={onClick}>
      <Trash2 />
    </Button>
  );
}

export function AddButton({ children, onClick }: { children: ReactNode; onClick(): void }) {
  return (
    <Button variant="outline" size="sm" className="w-full" onClick={onClick}>
      <Plus /> {children}
    </Button>
  );
}

interface SelectFieldProps<Value extends string> {
  value: Value;
  options: { value: Value; label: string }[];
  onChange(value: Value): void;
  /** Accessible name, because the select has no visible label. */
  ariaLabel: string;
  className?: string;
}

/** A native select. It is small, works on touch screens and needs no popup. */
export function SelectField<Value extends string>({ value, options, onChange, ariaLabel, className }: SelectFieldProps<Value>) {
  // A value that is not in the list (a state the code editor wrote) is still shown, so the select never lies.
  const shown = options.some((option) => option.value === value) ? options : [{ value, label: value }, ...options];
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value as Value)}
      className={cn(
        "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-8 min-w-0 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]",
        className,
      )}
    >
      {shown.map((option) => (
        <option key={option.value} value={option.value} className="bg-popover text-popover-foreground">
          {option.label}
        </option>
      ))}
    </select>
  );
}

interface MoveButtonsProps {
  canMoveUp: boolean;
  canMoveDown: boolean;
  upLabel: string;
  downLabel: string;
  onMove(step: -1 | 1): void;
}

export function MoveButtons({ canMoveUp, canMoveDown, upLabel, downLabel, onMove }: MoveButtonsProps) {
  return (
    <div className="flex shrink-0">
      <Button variant="ghost" size="icon-sm" aria-label={upLabel} title={upLabel} disabled={!canMoveUp} onClick={() => onMove(-1)}>
        <ChevronUp />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={downLabel} title={downLabel} disabled={!canMoveDown} onClick={() => onMove(1)}>
        <ChevronDown />
      </Button>
    </div>
  );
}
