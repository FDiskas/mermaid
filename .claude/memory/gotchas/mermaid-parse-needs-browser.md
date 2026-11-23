---
name: mermaid-parse-needs-browser
description: Mermaid parse fails under bun for class, state and git diagrams (DOMPurify); a dev server may already hold port 3000 with a stale build.
keywords: [mermaid.parse, bun test, DOMPurify, e2e, port 3000, PORT, getDiagram]
updated: 2026-11-23
---

### Fact
`mermaid.parse` in `bun test` works for sequence and ER, but throws `DOMPurify.addHook is not a function` for class and state, and `DOMPurify.sanitize is not a function` for git. There is no DOM in bun. Validity of generated code must be checked in the browser (e2e), not in unit tests.
A dev server can already run on port 3000 and serve an old build ("Build Failed", cannot resolve new files). Start a second one with `PORT=3917 bun src/index.ts` and run `bun e2e/run.mjs http://localhost:3917/`.

### How to apply
Unit tests: check text only (round trip, types of entries). E2E block `line-editors`: check real Mermaid result. Some Mermaid rules are stateful and only fail in the browser (git: a branch needs a commit before it; sequence: `-A` deactivates an active participant).
