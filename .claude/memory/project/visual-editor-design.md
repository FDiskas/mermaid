---
name: visual-editor-design
description: How the visual editor works, what it covers, and what it deliberately does not do.
keywords: [visual editor, flowchart, pie, serializer, comments, source of truth, layout, sequence, class, state, er, git, line model, raw lines]
source: user request on 2026-11-11 (clone of mermaid-drawing.com plus a visual editor)
updated: 2026-11-23
---

### Decision
The Mermaid text in CodeMirror is the only source of truth. A visual edit parses the flowchart with Mermaid's own parser (`getDiagramFromText().db`), changes a model, writes canonical code back (`src/lib/flowchart/serialize.ts`) and replaces the editor text (one undo step). Round-trip was checked on 12 sample flowcharts: idempotent and same rendered structure.

### Scope and limits
- Visual editing: flowchart, pie, timeline, quadrant, mindmap, journey, gantt, sequence, class, state, ER and git. Other diagram types show a message and use the code editor. The model-based types (all but flowchart) are edited only in the inspector panel (no click-to-select in the preview).
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

### Line-based editors (sequence, class, state, ER, git)
User asked for these editors on 2026-11-23 and said: do not break the diagrams. Their syntax is large (blocks, notes, styles, new syntax), so they do not rebuild the code from a model.
- `src/lib/line-model.ts`: the body is a list of entries. A line the editor understands is a typed entry. Every other line is a `raw` entry, kept in place. Typed entries remember `origin` (raw text plus what the editor would write at parse time). Unchanged entry → original text is written back, so untouched lines are byte-identical.
- Strict regexes. A doubtful line stays raw: any line with `;`, git names in quotes, ER attribute blocks with an unknown line (the whole block is raw), class blocks that are nested or not closed, ids with `-` in sequence and state.
- Ids are not renamed when something else mentions them. Class, ER entity and git branch names can be renamed only if no other line (and no relation) uses the name; a new class or entity can be renamed at once. Git branch rename also updates checkout and merge. Sequence and state ids have no rename (sequence has an alias field, state has a description).
- Move up/down swaps only with a neighbour of the same group, so a raw `end`, `}` or `loop` never moves and nothing moves across it.
- An entity with no attributes stays `NAME {\n}`; a bare `NAME` line would be read back as raw and vanish from the panel.
- Safety net: these editors have `checked: true` in `visual-editors.tsx`. App `commitCode` asks Mermaid (`getDiagram`) first. If it throws, the edit is not applied and `editRejected` shows a notice. The check is skipped when the diagram is already invalid (the user must be able to repair it). Real example: deleting the first commit of a git graph that has a branch is refused.
- Tests: `src/lib/line-editors.corpus.test.ts` holds real-syntax samples (round trip without edit, and stable write after edit). Unit tests cannot call Mermaid for class, state and git (see gotcha), so validity is checked in the browser by e2e block `line-editors`.

