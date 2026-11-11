import { useEffect, useRef, useState, type ReactNode } from "react";
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
}

/**
 * A text field that reports every edit, but ignores incoming prop changes while it has focus.
 * This stops the value being rewritten under the cursor when the diagram is re-parsed.
 */
export function CommitField({ value, onCommit, multiline, id, type, className, focusToken, inputMode }: CommitFieldProps) {
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
    <Input ref={element} type={type} inputMode={inputMode} className={cn("h-8 text-sm", className)} {...shared} />
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
