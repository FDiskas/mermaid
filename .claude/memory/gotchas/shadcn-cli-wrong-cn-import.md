---
name: shadcn-cli-wrong-cn-import
description: Running `bunx shadcn add` here writes `import { cn } from "cn"` and installs an unrelated npm package named `cn`.
keywords: [shadcn, cn, utils, components.json, bun]
updated: 2026-11-11
---

### Fact
`bunx --bun shadcn@latest add <component>` generated files with `import { cn } from "cn"` and added `cn` and `radix-ui` to package.json. The alias in components.json is `@/lib/utils`.

### How to apply
After every `shadcn add`: replace `from "cn"` with `from "@/lib/utils"` in `src/components/ui/*.tsx`, then `bun remove cn`. Keep `radix-ui` (the new components import from it).
