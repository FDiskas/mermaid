import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab, isolateHistory, redo, redoDepth, undo, undoDepth } from "@codemirror/commands";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { setDiagnostics } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { mermaid } from "codemirror-lang-mermaid";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { editorTheme } from "@/lib/editor-theme";

export interface CodeEditorHandle {
  /** Replace the whole document. Becomes one undo step. */
  replace(text: string, options?: { isolate?: boolean }): void;
  undo(): void;
  redo(): void;
  focus(): void;
  hasFocus(): boolean;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  dark: boolean;
  error?: { message: string; line?: number } | null;
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
}

/** Smallest single edit that turns `a` into `b`. Keeps the cursor and undo history sensible. */
function diff(a: string, b: string) {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  return { from: start, to: endA, insert: b.slice(start, endB) };
}

export const CodeEditor = forwardRef<CodeEditorHandle, Props>(function CodeEditor(
  { value, onChange, dark, error, onHistoryChange },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment()).current;
  const onChangeRef = useRef(onChange);
  const onHistoryRef = useRef(onHistoryChange);
  const valueRef = useRef(value);
  onChangeRef.current = onChange;
  onHistoryRef.current = onHistoryChange;

  const replace = (text: string, options?: { isolate?: boolean }) => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === text) return;
    view.dispatch({
      changes: diff(current, text),
      annotations: [Transaction.addToHistory.of(true), ...(options?.isolate ? [isolateHistory.of("full")] : [])],
    });
  };

  useImperativeHandle(ref, () => ({
    replace,
    undo: () => viewRef.current && undo(viewRef.current),
    redo: () => viewRef.current && redo(viewRef.current),
    focus: () => viewRef.current?.focus(),
    hasFocus: () => Boolean(viewRef.current?.hasFocus),
  }));

  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: valueRef.current,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          EditorView.lineWrapping,
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, indentWithTab]),
          mermaid(),
          themeCompartment.of(editorTheme(dark)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const text = update.state.doc.toString();
              valueRef.current = text;
              onChangeRef.current(text);
            }
            if (update.docChanged || update.transactions.length > 0) {
              onHistoryRef.current?.({
                canUndo: undoDepth(update.state) > 0,
                canRedo: redoDepth(update.state) > 0,
              });
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The editor is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Text changed from outside (visual editor, templates, history, …).
  useEffect(() => {
    if (value !== valueRef.current) {
      valueRef.current = value;
      replace(value);
    }
  });

  useEffect(() => {
    viewRef.current?.dispatch({ effects: themeCompartment.reconfigure(editorTheme(dark)) });
  }, [dark, themeCompartment]);

  // Mark the line Mermaid complains about.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const diagnostics = [];
    if (error?.line) {
      const lineNo = Math.min(Math.max(error.line, 1), view.state.doc.lines);
      const line = view.state.doc.line(lineNo);
      diagnostics.push({ from: line.from, to: Math.max(line.to, line.from + 1), severity: "error" as const, message: error.message.split("\n")[0] ?? "" });
    }
    view.dispatch(setDiagnostics(view.state, diagnostics));
  }, [error, value]);

  return <div ref={host} className="h-full min-h-0 overflow-hidden" data-testid="code-editor" />;
});
