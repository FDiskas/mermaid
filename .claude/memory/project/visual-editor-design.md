---
name: visual-editor-design
description: How the visual editor works, what it covers, and what it deliberately does not do.
keywords: [visual editor, flowchart, pie, serializer, comments, source of truth, layout]
source: user request on 2026-11-11 (clone of mermaid-drawing.com plus a visual editor)
updated: 2026-11-23
---

### Decision
The Mermaid text in CodeMirror is the only source of truth. A visual edit parses the flowchart with Mermaid's own parser (`getDiagramFromText().db`), changes a model, writes canonical code back (`src/lib/flowchart/serialize.ts`) and replaces the editor text (one undo step). Round-trip was checked on 12 sample flowcharts: idempotent and same rendered structure.

### Scope and limits
- Visual editing: flowchart, pie, timeline, quadrant, mindmap, journey and gantt. Sequence, class, state, ER and git have no editor yet. Other diagram types show a message and use the code editor. The model-based types (all but flowchart) are edited only in the inspector panel (no click-to-select in the preview).
- Comments inside the diagram are lost on a visual edit. Front matter and `%%{init}%%` before the keyword are kept.
- No manual node positions: Mermaid auto-layout decides placement.
- Not built: PDF export, AI button (needs a backend), box (marquee) selection.
- Grouping: Shift/Ctrl/Cmd-click toggles nodes and groups into a multi-selection (arrows drop out). The "Group" button or Ctrl/Cmd+G calls `groupItems` (`ops.ts`). New group id is `G<n>`. Same parent for all items → group is nested there; mixed parents → top level. Groups emptied by the move are removed together with arrows that pointed at them. Ungroup is the inverse.

### Why
Keeping one source of truth avoids sync bugs between text and a separate visual state, and gives undo/redo for free through CodeMirror history.

### Timeline
`src/lib/timeline.ts` parses the text itself (Mermaid has no useful `db` for it). Periods before the first `section` go in a section with `title: null`. A colon inside a text is written as `#colon;` (Mermaid decodes it; checked in the browser). An empty label is written as `…`, so the line stays a period.

### Adding another diagram type
Write `src/lib/<type>.ts` (model, `parse`, `serialize`, tests), a panel in `src/components/inspector/`, and one line in `visual-editors.tsx`. Sectioned types (timeline, journey, gantt) reuse `SectionList.tsx`. Every model keeps unknown lines in `extra` and writes `…` in place of an empty name, so the line is still valid when parsed again. Gantt: an id without a start is not written (Mermaid reads two values as start and end). Mindmap keeps node text raw, including shapes like `root((x))`.
