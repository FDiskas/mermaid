---
name: visual-editor-design
description: How the visual editor works, what it covers, and what it deliberately does not do.
keywords: [visual editor, flowchart, pie, serializer, comments, source of truth, layout]
source: user request on 2026-11-11 (clone of mermaid-drawing.com plus a visual editor)
updated: 2026-11-11
---

### Decision
The Mermaid text in CodeMirror is the only source of truth. A visual edit parses the flowchart with Mermaid's own parser (`getDiagramFromText().db`), changes a model, writes canonical code back (`src/lib/flowchart/serialize.ts`) and replaces the editor text (one undo step). Round-trip was checked on 12 sample flowcharts: idempotent and same rendered structure.

### Scope and limits
- Visual editing: flowchart and pie only. Other diagram types show a message and use the code editor.
- Comments inside the diagram are lost on a visual edit. Front matter and `%%{init}%%` before the keyword are kept.
- No manual node positions: Mermaid auto-layout decides placement.
- Not built: PDF export, AI button (needs a backend), multi-select, creating subgraphs visually.

### Why
Keeping one source of truth avoids sync bugs between text and a separate visual state, and gives undo/redo for free through CodeMirror history.
