---
name: focus-highlight
description: How the selected item is marked in the code editor, the side panel and the preview, for all 12 editable diagram types.
keywords: [focus, highlight, selection, cursor, preview click, FocusRow, FocusAdapter, mv-focus, cm-focus-line]
source: user request on 2026-11-23 ("I want to see highlight so I know what I am going to edit")
updated: 2026-11-23
---

### Decision
One item is "in focus". The code (cursor line), the panel (row) and the preview (click) all show it, in both directions. User chose: all 12 types, all three directions, stronger preview highlight.

### How it works
- `src/lib/focus/<type>.ts`: a `FocusAdapter` per type (`items(code)`, `locate`, `pick`). Registry in `focus/index.ts`. Keys are shared with the panel: `String(entryIndex)` for line-based types, helpers like `sliceKey` for model-based types.
- Flowchart keeps its own `Selection`. `focus/flowchart.ts` finds its code lines from the text (no line data in the model).
- Models get no line fields (tests use `toEqual`). Adapters scan the code with the model regexes (exported from the model files) or use `entryItems` (counts lines of `origin.raw`).
- Preview marks elements with class `mv-focus` (CSS glow + outline in `index.css`). Code marks lines with `cm-focus-line`. Panel rows are `FocusRow` (`inspector/focus.tsx`).
- `source` of the focus ("code" | "panel" | "preview") decides who scrolls: the view that caused the change does not scroll.

### Limits
Items that Mermaid draws without an element (git `main` branch, raw lines, state `[*]`) focus nothing. Mermaid draws gantt and pie in sorted order and merges equal gantt sections: see the gotcha notes for gantt, state and git.

### Why text matching
Mermaid SVG has no source line data. Items are found by id (class, state, ER, gantt) or by the text they draw plus order of equal texts.
