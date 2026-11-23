---
name: mermaid-state-git-svg-mapping
description: How Mermaid 12 numbers state edges and draws git commits, tags and branches; the focus adapters for state and git rely on this.
keywords: [state diagram, git graph, edge id, note edge, commit tag, cherry-pick, focus, svg]
updated: 2026-11-23
---

### Fact
- State: transitions are `path.transition#<svg>-edge<N>`. N counts transitions AND notes (`note right of X : t`, or a `note … end note` block) in code order, including lines inside composite states and lines the editor keeps raw. A note edge has an id that is not `edgeN`. A label is `g.edgeLabels g.label[data-id="edgeN"]`, only for transitions with text. A composite state is `g.statediagram-cluster#<svg>-state-<id>-<n>`, not `g.node`.
- Git: commits are drawn in code order. A merge draws two circles with the same id. HIGHLIGHT draws two `rect`s, REVERSE adds a `path`, cherry-pick draws five elements. The id class is the first class that is not `commit`/`commit-merge`/`commit-reverse`. A plain merge and a cherry-pick have no `text.commit-label`. Tags (`polygon.tag-label-bkg`, `circle.tag-hole`, `text.tag-label`) carry no id: match them to a commit by distance. Branch line, label and box are drawn in the same order, but their class number can repeat and `order:` does not change the DOM order.
- A cherry-pick, or a `commit msg: …`, stays a raw line in the editor but still draws a commit, so raw lines must be counted.

### How to apply
Change `src/lib/focus/state.ts` or `git.ts` together with these facts. Check against the real DOM in a browser (`PORT=3917 bun src/index.ts`), not against assumptions.
