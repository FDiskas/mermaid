---
name: codemirror-mermaid-no-timeline
description: codemirror-lang-mermaid has no grammar for timeline, quadrant, class, state, ER and git, so those get no highlighting; src/lib/diagram-highlight.ts covers them with a ViewPlugin.
keywords: [timeline, syntax highlighting, codemirror-lang-mermaid, streamparser, decorations]
updated: 2026-11-23
---

### Fact
`codemirror-lang-mermaid` 0.5 highlights only mindmap, pie, flowchart, sequence, journey, requirement and gantt. `src/lib/diagram-highlight.ts` covers timeline, quadrant, class, state, ER and git. It marks tokens with `Decoration.mark` classes (`cm-mmd-<role>`), and `editor-theme.ts` colours them from the same palette.

### How to apply
For another unsupported type, add a rule list in `diagram-highlight.ts` (rules are applied in order; `atStart` and `after` give simple context). Adding `@codemirror/streamparser` as a direct dependency was refused in the session of 2026-11-23, so do not use `bun add` for it without asking the user.
