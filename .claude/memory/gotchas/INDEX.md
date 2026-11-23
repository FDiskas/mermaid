# Gotchas

- [shadcn-cli-wrong-cn-import.md](shadcn-cli-wrong-cn-import.md) — `shadcn add` imports `cn` from a bogus package.
- [mermaid-foreignobject-breaks-png.md](mermaid-foreignobject-breaks-png.md) — some Mermaid diagrams ignore `htmlLabels:false`; PNG export fails.
- [mermaid-label-wrap-and-back-edges.md](mermaid-label-wrap-and-back-edges.md) — labels wrap mid-word without `wrappingWidth`; back edges tangle TB charts; README chart image rebuild.
- [e2e-single-browser-dies.md](e2e-single-browser-dies.md) — long Playwright runs in one Chrome fail with "Target closed".
- [codemirror-mermaid-no-timeline.md](codemirror-mermaid-no-timeline.md) — no grammar for timeline, quadrant, class, state, ER, git in codemirror-lang-mermaid; custom highlighter used.
- [mermaid-parse-needs-browser.md](mermaid-parse-needs-browser.md) — `mermaid.parse` fails under bun for class, state, git; a stale dev server may hold port 3000; use PORT=3917.
- [mermaid-gantt-journey-draw-order.md](mermaid-gantt-journey-draw-order.md) — gantt sorts bars by date and gives auto ids `taskN`; journey skips empty sections; focus adapters rely on this.
- [mermaid-state-git-svg-mapping.md](mermaid-state-git-svg-mapping.md) — state edge ids count notes too; git commits, tags, branches in the SVG; raw lines still draw commits; focus adapters rely on this.
