---
name: e2e-single-browser-dies
description: One long Playwright run in a single Chrome ends with "Target page, context or browser has been closed" mid-suite; each block passes alone.
keywords: [e2e, playwright, chrome, target closed, timeout]
updated: 2026-11-11
---

### Fact
All blocks passed when run alone but a single long run died partway with "Target closed". Playwright steps that stall (for example clicking an element inside a dropdown that is still closing) also report "Target closed" after the 30 s timeout, not a timeout error.

### How to apply
`e2e/run.mjs` starts one process per block (`ONLY=<block>`). After a download or menu action, wait for `[role=menu]` to detach before the next click. Treat a "Target closed" after about 30 s as a stuck step, not a crash.
