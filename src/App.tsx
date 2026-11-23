import { BookOpen, Code2, Eye, History, Link2, Maximize2, Minimize2, PanelLeft, PanelLeftClose, PanelRight, Redo2, RefreshCw, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AboutDialog } from "@/components/AboutDialog";
import { CodeEditor, type CodeEditorHandle, type CursorPosition } from "@/components/CodeEditor";
import { ExportMenu } from "@/components/ExportMenu";
import { Flash, useFlash } from "@/components/Flash";
import { Header } from "@/components/Header";
import { HistoryDialog } from "@/components/HistoryDialog";
import { Inspector } from "@/components/inspector/Inspector";
import { CanvasToolbar } from "@/components/preview/CanvasToolbar";
import { PreviewCanvas, type PreviewCanvasHandle } from "@/components/preview/PreviewCanvas";
import { Splitter } from "@/components/Splitter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDiagram } from "@/hooks/useDiagram";
import { useFlowModel } from "@/hooks/useFlowModel";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useSnapshots, type Snapshot } from "@/hooks/useSnapshots";
import { detectDiagramKind } from "@/lib/diagram-type";
import { labelToText, type FlowModel, type Selection } from "@/lib/flowchart/model";
import { addEdge, addNode, groupItems, removeEdge, removeNode, ungroup, updateEdge, updateGroup, updateNode } from "@/lib/flowchart/ops";
import { serializeFlowchart } from "@/lib/flowchart/serialize";
import { FOCUS_ADAPTERS, itemAtLine, itemByKey, type FocusSource, type FocusState } from "@/lib/focus";
import { flowchartLines, flowchartSelectionAt } from "@/lib/focus/flowchart";
import { useTranslate } from "@/lib/i18n";
import { getDiagram, type DiagramTheme } from "@/lib/mermaid-runtime";
import { decodeShareHash, encodeShareHash } from "@/lib/share";
import { DEFAULT_CODE, type Template } from "@/lib/templates";
import { readRenderedColors } from "@/lib/svg-targets";
import { cn } from "@/lib/utils";
import "./index.css";

type ThemeChoice = DiagramTheme | "auto";
const DIAGRAM_THEMES: ThemeChoice[] = ["auto", "default", "dark", "forest", "neutral", "base"];
const MERMAID_DOCS = "https://mermaid.js.org/intro/";

/** Limits of the code panel, as a fraction of the width of the page. */
const MIN_SPLIT = 0.2;
const MAX_SPLIT = 0.7;
/** Limits of the visual editor panel in pixels. */
const MIN_INSPECTOR_WIDTH = 240;
const MAX_INSPECTOR_WIDTH = 640;
const DEFAULT_INSPECTOR_WIDTH = 288;
/** The preview must keep at least this width, whatever the size of the visual editor panel. */
const MIN_PREVIEW_WIDTH = 240;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function App() {
  const t = useTranslate();
  const [code, setCode] = usePersistentState<string>("code", DEFAULT_CODE);
  const [appTheme, setAppTheme] = usePersistentState<"dark" | "light">("theme", window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  const [themeChoice, setThemeChoice] = usePersistentState<ThemeChoice>("diagram-theme", "auto");
  const [exportScale, setExportScale] = usePersistentState("export-scale", 3);
  const [transparent, setTransparent] = usePersistentState("export-transparent", false);
  const [split, setSplit] = usePersistentState("split", 0.38);
  const [inspectorOpen, setInspectorOpen] = usePersistentState("inspector-open", window.innerWidth >= 768);
  const [inspectorWidth, setInspectorWidth] = usePersistentState("inspector-width", DEFAULT_INSPECTOR_WIDTH);
  const [codeOpen, setCodeOpen] = usePersistentState("code-open", true);

  const [mobileTab, setMobileTab] = useState<"code" | "preview">("code");
  const [expanded, setExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [selected, setSelected] = useState<NonNullable<Selection>[]>([]);
  /** The item in focus in a diagram type other than a flowchart (see `lib/focus`). */
  const [focus, setFocus] = useState<FocusState | null>(null);
  /** Where the last flowchart selection came from. The code editor scrolls to it unless it came from the editor itself. */
  const [selectionSource, setSelectionSource] = useState<FocusSource>("preview");
  const [connect, setConnect] = useState<{ source: string | null } | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const [focusToken, setFocusToken] = useState(0);
  const [scale, setScale] = useState(1);
  const [undoState, setUndoState] = useState({ canUndo: false, canRedo: false });
  const [flashMessage, flash] = useFlash();

  const editor = useRef<CodeEditorHandle>(null);
  const canvas = useRef<PreviewCanvasHandle>(null);

  /** The single selected element, or null when nothing or several elements are selected. */
  const selection: Selection = selected.length === 1 ? selected[0]! : null;
  const setSelection = useCallback((next: Selection) => setSelected(next ? [next] : []), []);

  const dark = appTheme === "dark";
  const diagramTheme: DiagramTheme = themeChoice === "auto" ? (dark ? "dark" : "default") : themeChoice;
  const exportBackground = diagramTheme === "dark" ? "#111827" : "#ffffff";

  const kind = useMemo(() => detectDiagramKind(code), [code]);
  const { rendered, error } = useDiagram(code, diagramTheme);
  const [flow, setFlow] = useFlowModel(code, kind === "flowchart");
  const snapshots = useSnapshots(code);

  const focusAdapter = FOCUS_ADAPTERS[kind];
  const focusItems = useMemo(() => focusAdapter?.items(code) ?? [], [focusAdapter, code]);
  const focusedItem = itemByKey(focusItems, focus?.key ?? null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Open a shared link (`#d=…`) on load, or when one is pasted into the address bar of an open tab.
  useEffect(() => {
    const openSharedLink = () => {
      if (!location.hash) return;
      decodeShareHash(location.hash).then((shared) => {
        if (shared === null) return;
        replaceCode(shared);
        history.replaceState(null, "", location.pathname + location.search);
      });
    };
    openSharedLink();
    window.addEventListener("hashchange", openSharedLink);
    return () => window.removeEventListener("hashchange", openSharedLink);
    // `replaceCode` only uses refs and state setters, so it is safe to capture once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Replace the whole document from outside the editor (templates, restore, clear, shared links). */
  function replaceCode(text: string) {
    editor.current?.replace(text, { isolate: true });
    setCode(text);
    setSelection(null);
    setFocus(null);
    setConnect(null);
    setFitToken((n) => n + 1);
  }

  const commitFlow = useCallback(
    (next: FlowModel, nextSelection?: Selection) => {
      setFlow(next);
      editor.current?.replace(serializeFlowchart(next));
      if (nextSelection !== undefined) {
        setSelectionSource("panel");
        setSelection(nextSelection);
      }
    },
    [setFlow],
  );

  /** True after the panel proposed code that Mermaid refuses. The code editor then keeps its old text. */
  const [editRejected, setEditRejected] = useState(false);

  // The notice is about the text it was shown for.
  useEffect(() => setEditRejected(false), [code]);

  const commitCode = useCallback(async (text: string, options?: { check?: boolean }) => {
    if (options?.check) {
      try {
        await getDiagram(text);
      } catch {
        setEditRejected(true);
        return;
      }
    }
    setEditRejected(false);
    editor.current?.replace(text);
  }, []);

  // Drop the selection when its element no longer exists.
  useEffect(() => {
    if (!flow) return;
    const exists = (item: NonNullable<Selection>) =>
      item.kind === "node" ? flow.nodes.some((n) => n.id === item.id)
      : item.kind === "edge" ? flow.edges.some((e) => e.id === item.id)
      : flow.groups.some((g) => g.id === item.id);
    setSelected((current) => (current.every(exists) ? current : current.filter(exists)));
  }, [flow]);

  useEffect(() => {
    if (kind !== "flowchart") {
      setSelection(null);
      setConnect(null);
    }
    setFocus(null);
  }, [kind]);

  // The focus goes when its item is gone (a row was deleted).
  useEffect(() => {
    if (focus && !focusedItem) setFocus(null);
  }, [focus, focusedItem]);

  const editable = kind === "flowchart" && flow !== null && inspectorOpen;

  /** The lines of the code editor that belong to what is selected (flowchart) or in focus (other diagrams). */
  const focusedLines = useMemo(() => {
    if (kind === "flowchart") {
      if (!editable || !flow) return [];
      return selected.flatMap((item) => flowchartLines(code, flow, item));
    }
    if (!focusedItem) return [];
    return Array.from({ length: focusedItem.to - focusedItem.from + 1 }, (_, offset) => focusedItem.from + offset);
  }, [kind, editable, flow, selected, code, focusedItem]);

  const focusSource = kind === "flowchart" ? selectionSource : focus?.source;

  const locateFocus = useMemo(() => {
    if (!focusAdapter || !focus) return null;
    return (root: SVGSVGElement) => focusAdapter.locate(root, focusItems, focus.key);
  }, [focusAdapter, focusItems, focus]);

  const pickFocus = useMemo(() => {
    if (!focusAdapter) return null;
    return (target: Element) => {
      const root = target.closest("svg");
      const key = root ? focusAdapter.pick(root, focusItems, target) : null;
      setFocus(key ? { key, source: "preview" } : null);
    };
  }, [focusAdapter, focusItems]);

  const focusFromPanel = useCallback((key: string) => setFocus((current) => (current?.key === key ? current : { key, source: "panel" })), []);

  /** The cursor of the code editor moved: what it is on is now in focus. */
  const followCursor = ({ line, column }: CursorPosition) => {
    if (kind === "flowchart") {
      if (!editable || !flow) return;
      const next = flowchartSelectionAt(code, flow, line, column);
      const same = selected.length === (next ? 1 : 0) && (!next || (selected[0]?.kind === next.kind && selected[0]?.id === next.id));
      if (same) return;
      setSelectionSource("code");
      setSelection(next);
      return;
    }
    const item = itemAtLine(focusItems, line);
    setFocus((current) => (item ? (current?.key === item.key ? current : { key: item.key, source: "code" }) : null));
  };

  const addNewNode = useCallback(() => {
    if (!flow) return;
    const siblingOf = selection?.kind === "node" ? selection.id : undefined;
    const next = addNode(flow, { label: t.newNodeLabel, siblingOf });
    commitFlow(next.model, { kind: "node", id: next.id });
    setInspectorOpen(true);
    setFocusToken((n) => n + 1);
  }, [flow, selection, t, commitFlow, setInspectorOpen]);

  const deleteSelection = useCallback(() => {
    if (!flow || selected.length === 0) return;
    // Several selected items are only nodes and groups (see handleSelect), so ids stay valid while we apply them in turn.
    const next = selected.reduce((model, item) => {
      if (item.kind === "node") return removeNode(model, item.id);
      if (item.kind === "edge") return removeEdge(model, item.id);
      return ungroup(model, item.id);
    }, flow);
    commitFlow(next, null);
  }, [flow, selected, commitFlow]);

  const groupSelection = useCallback(() => {
    if (!flow || selected.length < 2) return;
    const grouped = groupItems(flow, selected.filter((item) => item.kind !== "edge").map((item) => item.id), t.newGroupTitle);
    if (grouped.id) commitFlow(grouped.model, { kind: "group", id: grouped.id });
  }, [flow, selected, t, commitFlow]);

  const handleSelect = (next: Selection, additive = false) => {
    if (connect) {
      if (next?.kind !== "node") return;
      if (!connect.source) {
        setConnect({ source: next.id });
        return;
      }
      if (!flow) return;
      const withEdge = addEdge(flow, connect.source, next.id);
      commitFlow(withEdge, { kind: "edge", id: withEdge.edges.at(-1)!.id });
      setConnect(null);
      return;
    }
    if (additive) {
      if (!next) return;
      if (next.kind !== "edge") {
        // Shift-click toggles a node or group in the selection. Arrows cannot be grouped, so they drop out.
        setSelected((current) => {
          const items = current.filter((item) => item.kind !== "edge");
          const present = items.some((item) => item.kind === next.kind && item.id === next.id);
          return present ? items.filter((item) => !(item.kind === next.kind && item.id === next.id)) : [...items, next];
        });
        return;
      }
    }
    setSelectionSource("preview");
    setSelection(next);
    if (next) setFocusToken(0);
  };

  const labelOf = (target: NonNullable<Selection>): string | undefined => {
    if (!flow) return undefined;
    if (target.kind === "node") return labelToText(flow.nodes.find((n) => n.id === target.id)?.label ?? "");
    if (target.kind === "edge") return labelToText(flow.edges.find((e) => e.id === target.id)?.label ?? "");
    return flow.groups.find((g) => g.id === target.id)?.title;
  };

  const commitLabel = (target: NonNullable<Selection>, text: string) => {
    if (!flow) return;
    if (target.kind === "node") commitFlow(updateNode(flow, target.id, { label: text }));
    else if (target.kind === "edge") commitFlow(updateEdge(flow, target.id, { label: text }));
    else commitFlow(updateGroup(flow, target.id, { title: text }));
  };

  // Keyboard: Delete removes the selection, Escape cancels, Ctrl/Cmd+Z undoes when the editor is not focused.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = (event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true'], .cm-editor");
      if (event.key === "Escape") {
        if (connect) setConnect(null);
        else if (!typing) setSelection(null);
        return;
      }
      if (typing || document.querySelector("[role='dialog'], [role='menu']")) return;
      const mod = event.metaKey || event.ctrlKey;
      if ((event.key === "Delete" || event.key === "Backspace") && selected.length > 0) {
        event.preventDefault();
        deleteSelection();
      } else if (mod && !event.shiftKey && event.key.toLowerCase() === "g" && selected.length > 1) {
        event.preventDefault();
        groupSelection();
      } else if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) editor.current?.redo();
        else editor.current?.undo();
      } else if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        editor.current?.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connect, selected, deleteSelection, groupSelection]);

  const share = async () => {
    const hash = await encodeShareHash(code);
    const url = `${location.origin}${location.pathname}${hash}`;
    try {
      await navigator.clipboard.writeText(url);
      flash(t.linkCopied);
    } catch {
      history.replaceState(null, "", hash);
      flash(t.linkCopied);
    }
  };

  const themeLabel = (choice: ThemeChoice): string => {
    const labels = { auto: t.themeAuto, default: t.themeDefault, dark: t.themeDark, forest: t.themeForest, neutral: t.themeNeutral, base: t.themeBase };
    return labels[choice];
  };

  const previewPanel = (
    <section
      className={cn(
        "bg-background flex min-w-0 flex-1 flex-col",
        mobileTab !== "preview" && !expanded && "hidden md:flex",
        expanded && "fixed inset-0 z-30",
      )}
      data-testid="preview-panel"
    >
      <div className="bg-card flex h-10 shrink-0 items-center gap-1 border-b px-3">
        {!codeOpen && (
          <span className="hidden md:inline-flex">
            <IconButton label={t.showCodeEditor} onClick={() => setCodeOpen(true)} testId="code-open"><PanelLeft /></IconButton>
          </span>
        )}
        <h2 className="text-muted-foreground mr-auto truncate text-xs font-medium" data-testid="preview-title">
          {t.preview} ({Math.round(scale * 100)}%)
        </h2>
        <div className="flex items-center rounded-md border">
          <IconButton label={t.zoomOut} onClick={() => canvas.current?.zoomOut()} testId="zoom-out"><ZoomOut /></IconButton>
          <IconButton label={t.zoomFit} onClick={() => canvas.current?.fit()} testId="zoom-fit"><RefreshCw /></IconButton>
          <IconButton label={t.zoomIn} onClick={() => canvas.current?.zoomIn()} testId="zoom-in"><ZoomIn /></IconButton>
        </div>
        <IconButton label={t.fullscreen} onClick={() => setExpanded((v) => !v)} testId="expand">
          {expanded ? <Minimize2 /> : <Maximize2 />}
        </IconButton>
        <IconButton label={t.visualEditor} active={inspectorOpen} onClick={() => setInspectorOpen((v) => !v)} testId="inspector-toggle">
          <PanelRight />
        </IconButton>
        <Button variant="outline" size="sm" onClick={share} data-testid="share">
          <Link2 /> <span className="hidden sm:inline">{t.share}</span>
        </Button>
        <ExportMenu
          diagram={rendered}
          background={exportBackground}
          scale={exportScale}
          onScaleChange={setExportScale}
          transparent={transparent}
          onTransparentChange={setTransparent}
          onNotify={flash}
        />
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <PreviewCanvas
            ref={canvas}
            diagram={rendered}
            emptyMessage={t.emptyDiagram}
            editable={editable}
            selected={selected}
            connectSource={connect?.source ?? null}
            connecting={connect !== null}
            fitToken={fitToken}
            dimmed={error !== null}
            locateFocus={locateFocus}
            onPick={pickFocus}
            onSelect={handleSelect}
            getLabel={labelOf}
            onCommitLabel={commitLabel}
            onScaleChange={setScale}
          />
          <CanvasToolbar
            editable={editable}
            connecting={connect !== null}
            onSelectTool={() => setConnect(null)}
            onConnectTool={() => setConnect(connect ? null : { source: selection?.kind === "node" ? selection.id : null })}
            onAddNode={addNewNode}
            canUndo={undoState.canUndo}
            canRedo={undoState.canRedo}
            onUndo={() => editor.current?.undo()}
            onRedo={() => editor.current?.redo()}
          />
          {connect && (
            <div className="bg-primary text-primary-foreground absolute top-16 left-1/2 z-10 -translate-x-1/2 rounded-full px-3 py-1 text-xs shadow-md" data-testid="connect-hint">
              {connect.source ? t.connectHint : t.connectHintSource}
            </div>
          )}
          {error && (
            <div role="alert" data-testid="render-error" className="bg-destructive/10 text-destructive border-destructive/40 absolute right-3 bottom-3 left-3 max-h-40 overflow-auto rounded-md border p-3 text-xs backdrop-blur">
              <strong className="mr-1">{t.renderError}.</strong>
              <pre className="font-mono whitespace-pre-wrap">{error.message}</pre>
            </div>
          )}
          <div className="absolute bottom-3 left-3 z-10" style={{ display: error ? "none" : undefined }}>
            <Select value={themeChoice} onValueChange={(value) => setThemeChoice(value as ThemeChoice)}>
              <SelectTrigger size="sm" aria-label={t.diagramTheme} title={t.diagramTheme} className="bg-card h-8 gap-2 text-xs" data-testid="diagram-theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top" align="start">
                {DIAGRAM_THEMES.map((choice) => (
                  <SelectItem key={choice} value={choice}>
                    {themeLabel(choice)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {inspectorOpen && (
          <Splitter
            testId="inspector-splitter"
            onChange={(clientX, bounds) => {
              const maxWidth = Math.min(MAX_INSPECTOR_WIDTH, bounds.width - MIN_PREVIEW_WIDTH);
              setInspectorWidth(Math.round(clamp(bounds.right - clientX, MIN_INSPECTOR_WIDTH, maxWidth)));
            }}
          />
        )}
        {inspectorOpen && (
          <Inspector
            width={inspectorWidth}
            kind={kind}
            flow={flow}
            code={code}
            selection={selection}
            selected={selected}
            hasError={error !== null}
            editRejected={editRejected}
            focusToken={focusToken}
            focus={focus}
            onFocus={focusFromPanel}
            onFlowChange={commitFlow}
            onCodeChange={commitCode}
            onStartConnect={(source) => setConnect({ source })}
            renderedColors={(target) => readRenderedColors(canvas.current?.elementFor(target) ?? null)}
            onClose={() => setInspectorOpen(false)}
          />
        )}
      </div>
    </section>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col">
        <Header
          kind={kind}
          dark={dark}
          onToggleTheme={() => setAppTheme(dark ? "light" : "dark")}
          onTemplate={(template: Template) => replaceCode(template.code)}
          onClear={() => replaceCode("")}
          onAbout={() => setAboutOpen(true)}
        />

        <div className="bg-card flex shrink-0 border-b md:hidden" role="tablist">
          {(["code", "preview"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={mobileTab === tab}
              onClick={() => setMobileTab(tab)}
              className={cn("flex flex-1 items-center justify-center gap-2 py-2 text-sm", mobileTab === tab ? "border-primary border-b-2 font-medium" : "text-muted-foreground")}
            >
              {tab === "code" ? <Code2 className="size-4" /> : <Eye className="size-4" />}
              {tab === "code" ? t.codeTab : t.previewTab}
            </button>
          ))}
        </div>

        <main className="flex min-h-0 flex-1">
          <section
            className={cn("bg-panel flex min-w-0 flex-col md:w-(--split) md:shrink-0", mobileTab !== "code" && "hidden md:flex", mobileTab === "code" && "flex-1 md:flex-none", !codeOpen && "md:hidden")}
            style={{ "--split": `${split * 100}%` } as React.CSSProperties}
          >
            <div className="bg-card flex h-10 shrink-0 items-center gap-1 border-b px-3">
              <h2 className="text-muted-foreground mr-auto truncate text-xs font-medium">{t.codeEditor}</h2>
              <IconButton label={t.undo} disabled={!undoState.canUndo} onClick={() => editor.current?.undo()} testId="editor-undo"><Undo2 /></IconButton>
              <IconButton label={t.redo} disabled={!undoState.canRedo} onClick={() => editor.current?.redo()} testId="editor-redo"><Redo2 /></IconButton>
              <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} data-testid="history-trigger">
                <History /> <span className="hidden lg:inline">{t.history}</span>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href={MERMAID_DOCS} target="_blank" rel="noreferrer">
                  <BookOpen /> <span className="hidden lg:inline">{t.documentation}</span>
                </a>
              </Button>
              <span className="hidden md:inline-flex">
                <IconButton label={t.hideCodeEditor} onClick={() => setCodeOpen(false)} testId="code-close"><PanelLeftClose /></IconButton>
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <CodeEditor
                ref={editor}
                value={code}
                onChange={setCode}
                dark={dark}
                error={error}
                onHistoryChange={setUndoState}
                focusedLines={focusedLines}
                revealFocus={focusSource !== undefined && focusSource !== "code"}
                onCursorChange={followCursor}
              />
            </div>
            <div className="text-muted-foreground border-t px-3 py-1.5 text-xs">{t.savedLocally}</div>
          </section>

          {codeOpen && <Splitter onChange={(clientX, bounds) => setSplit(clamp((clientX - bounds.left) / bounds.width, MIN_SPLIT, MAX_SPLIT))} />}
          {previewPanel}
        </main>
      </div>

      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        snapshots={snapshots.snapshots}
        onRemove={snapshots.remove}
        onRestore={(snapshot: Snapshot) => {
          replaceCode(snapshot.code);
          setHistoryOpen(false);
        }}
      />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <Flash message={flashMessage} />
    </TooltipProvider>
  );
}

function IconButton({ label, onClick, children, active, disabled, testId }: { label: string; onClick(): void; children: React.ReactNode; active?: boolean; disabled?: boolean; testId?: string }) {
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

export default App;
