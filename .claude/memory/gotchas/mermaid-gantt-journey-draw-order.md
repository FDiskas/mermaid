---
name: mermaid-gantt-journey-draw-order
description: How Mermaid draws gantt and journey, needed to map code items to SVG elements (focus feature). Gantt sorts bars by date and merges same-title sections; journey skips empty sections and shows foreignObject labels.
keywords: [gantt, journey, focus, svg, draw order, task id, section, foreignObject]
updated: 2026-11-23
---

### Fact
- Gantt draws the bars sorted by start date, not in code order. The bar is `rect.task` with `id="<svg id>-<task id>"`, the label is `text` with `id="<svg id>-<task id>-text"`. A task without an id gets `task1`, `task2`, ... (only tasks without an id advance the counter). Two `section` lines with the same title are merged into one drawn section. Empty sections are not drawn.
- Journey draws tasks and sections in code order, one `line.task-line` per task. A section with no tasks is not drawn. Tasks before the first `section` have no section box. Labels sit in a `switch` with `foreignObject` first, so the `text.task` is hidden: real clicks hit the `foreignObject` div.

### How to apply
`src/lib/focus/gantt.ts` finds tasks by drawn id; `src/lib/focus/journey.ts` by position. Do not match gantt tasks by position or by text order.
