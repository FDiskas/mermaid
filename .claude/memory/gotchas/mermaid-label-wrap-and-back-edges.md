---
name: mermaid-label-wrap-and-back-edges
description: With htmlLabels false, Mermaid wraps node labels mid-word unless flowchart.wrappingWidth is raised; edges that point back up a TB chart tangle the layout.
keywords: [mermaid, wrappingWidth, htmlLabels, flowchart, layout, readme, architecture chart]
updated: 2026-11-11
---

### Fact
- With `htmlLabels: false`, labels such as `usePersistentState` were cut in the middle of a word ("usePersistentSt ate"). Setting `flowchart.wrappingWidth: 400` fixed it in `scripts/export-readme-chart.ts`. The app's own `src/lib/mermaid-runtime.ts` does not set it.
- In a `flowchart TB`, edges that go back up (for example "SVG" from the renderer to the preview) cross everything. Draw only downward dependencies and describe the return path in text.

### How to apply
The README "Architecture" chart is the source for `docs/architecture(-dark).svg` and `.png`. After you edit the chart, run `bun run docs:chart` and commit the new images.
The images are transparent on purpose (user request). Mermaid's default theme has dark text, so there is a second `-dark` variant (Mermaid `dark` theme). The README picks one with `<picture>` and `prefers-color-scheme`.
