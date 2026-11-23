# Mermaid Drawing

A free, local-first Mermaid editor. Everything runs in the browser and is kept in `localStorage`; there is no backend.

- **Code editor** (CodeMirror 6) with Mermaid syntax highlighting and error markers
- **Live preview** (Mermaid.js) with pan, zoom (Ctrl/Cmd + wheel) and fit-to-screen
- **Visual editor** – click elements in the preview to edit them (see below)
- **Export** PNG (1x–4x, transparent background option), SVG, or copy the image to the clipboard
- **Share** link – the whole diagram is packed into the URL hash
- Version **history**, undo/redo, light/dark theme, diagram themes, 12 starter templates
- **Languages**: English, Lithuanian, Spanish, French, German, Russian

## Visual editor

| Diagram | What you can do |
| --- | --- |
| Flowchart | Click a node, arrow or group to select it. Double-click to rename inline. Change shape, fill / border / text colour, border width, arrow label, line style (solid / dotted / thick), arrow ends, direction. Add nodes, add connected nodes, connect two nodes, duplicate, reverse, delete (Delete key), ungroup. |
| Pie chart | Edit title, "show values", and slices (label, value, add, remove). |
| Timeline | Edit title, sections, periods and events (rename, add, remove). |
| Quadrant chart | Edit title, axis labels, quadrant names and points (name, x, y, add, remove). |
| Mind map | Edit the node tree (rename, add child, delete). |
| User journey | Edit title, sections, tasks (name, score 1–5, actors). |
| Gantt chart | Edit title, date and axis format, sections, tasks (name, start, end or duration, id, critical / done / active / milestone). |
| Sequence diagram | Edit participants and actors (display name), messages (sender, receiver, arrow, text) and notes. Move, add, delete. |
| Class diagram | Edit classes (members, name of a new class) and relations (ends, arrow, multiplicity, label). |
| State diagram | Edit state descriptions and transitions (from, to, label). |
| ER diagram | Edit entities (attributes with type, name, keys, comment) and relationships (ends, cardinality, line, label). |
| Git graph | Edit commits (id, tag, type), branches, checkouts and merges. |

Visual edits are applied to the code, which stays the single source of truth (they are undoable like typing).
Flowcharts are parsed with Mermaid's own parser and written back as canonical code, so **comments inside the diagram are not kept** when you edit visually. Front matter and `%%{init}%%` directives are kept.

Sequence, class, state, ER and git diagrams work line by line. The panel edits the lines it understands. Every other line (blocks such as `loop` or `alt`, notes, styles, comments, new syntax) stays exactly where it was, and a line you did not touch is not rewritten. Before a panel edit is applied, Mermaid checks the new code. If the result would be invalid (for example, you delete the first commit that a branch starts from), the edit is not applied and the panel says so.

## Develop

```bash
bun install
bun dev          # http://localhost:3000, hot reload
bun check        # type check
bun test         # unit tests
bun run build    # production build into dist/
bun e2e          # browser tests (needs the dev server running and Google Chrome)
```

Set `CHROME_PATH` if Chrome is not at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

## Translations

Strings live in `src/locales/translations.json` as `{ "key": { "en": "…", "lt": "…" } }`, read through
`src/lib/translate.ts` (typed keys, plurals, `{param}` templates). In components use `const t = useTranslate()`.
To add a language, add its code to every key in the JSON – the language list is derived from it.

## Layout

```
src/lib/flowchart/   model, parser (Mermaid's db), serializer, pure editing operations
src/lib/pie.ts       pie model
src/lib/timeline.ts, quadrant.ts, mindmap.ts, journey.ts, gantt.ts  models, parsers, serializers
src/lib/line-model.ts  base of the line-based editors; sequence.ts, class-diagram.ts, state.ts, er.ts, git-graph.ts use it
src/lib/diagram-highlight.ts  highlighting for timeline, quadrant, class, state, ER and git (the CodeMirror Mermaid package has no grammar for them)
src/lib/export.ts    SVG → PNG / SVG / clipboard
src/components/      UI (shadcn/ui in components/ui), preview canvas, inspector panels
src/components/inspector/visual-editors.tsx  registry: one line per diagram type that has a model-based panel
e2e/run.mjs          Playwright (playwright-core) browser tests
```

## Architecture

The Mermaid code in the editor is the single source of truth. `App` keeps the text and sends it to the renderer.
A click in the preview becomes a selection. An inspector edit changes the parsed model, and the serializer writes new code back into the editor.

```mermaid
flowchart TB
  serve["src/index.ts<br/>Bun.serve"] --> boot["frontend.tsx<br/>I18nProvider + App"]
  boot --> app{{"App.tsx<br/>Mermaid code = source of truth"}}

  subgraph UI["UI (src/components)"]
    editor["CodeEditor<br/>CodeMirror 6"]
    preview["PreviewCanvas<br/>pan, zoom, select"]
    inspector["Inspector<br/>flowchart and pie panels"]
    exportMenu["ExportMenu<br/>PNG, SVG, clipboard"]
    history["HistoryDialog"]
  end

  subgraph Hooks["State (src/hooks)"]
    useDiagram["useDiagram"]
    useFlowModel["useFlowModel"]
    useSnapshots["useSnapshots"]
    persist["usePersistentState"]
  end

  subgraph Lib["Logic (src/lib)"]
    runtime["mermaid-runtime<br/>render and parse"]
    flow["flowchart/<br/>parse, ops, serialize"]
    exporter["export<br/>SVG to PNG"]
    share["share<br/>URL hash"]
    storage["storage"]
  end

  ls[("localStorage")]

  app --> UI
  app --> Hooks
  app --> share
  useDiagram --> runtime
  useFlowModel --> flow
  exportMenu --> exporter
  history --> useSnapshots
  useSnapshots --> persist --> storage --> ls
```

Exported image of the same chart. It has a transparent background. GitHub shows the light or the dark version to match your theme.
Files: `docs/architecture.svg` and `docs/architecture-dark.svg` (PNG copies: [light](docs/architecture.png), [dark](docs/architecture-dark.png)).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/architecture-dark.svg">
  <img alt="Architecture of Mermaid Drawing" src="docs/architecture.svg">
</picture>

To rebuild the images after you change the chart, run `bun run docs:chart` (needs Google Chrome, like `bun e2e`).
