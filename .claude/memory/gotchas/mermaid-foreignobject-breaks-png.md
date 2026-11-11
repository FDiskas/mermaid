---
name: mermaid-foreignobject-breaks-png
description: Mermaid diagrams such as user journey always draw labels in <foreignObject>, which taints the canvas so PNG export fails silently.
keywords: [mermaid, png, export, foreignObject, htmlLabels, canvas, journey]
updated: 2026-11-11
---

### Fact
`htmlLabels: false` (set in `src/lib/mermaid-runtime.ts`) makes flowchart, sequence, class, state, ER and others use SVG `<text>`. The journey diagram ignores it. An SVG with `<foreignObject>` drawn to a canvas makes `toBlob` throw a security error.

### How to apply
`svgToPngBlob` in `src/lib/export.ts` calls `replaceForeignObjects` first (swaps them for `<text>` using computed colour/font). Keep that step. When adding a diagram type, run the "templates" e2e block to confirm PNG export still works.
