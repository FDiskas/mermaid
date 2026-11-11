Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun check` instead of `tsc --noEmit`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## Reporting style (always follow)

Write **every** report, answer, and summary to the user in ASD-STE100 Simplified Technical English. This applies on **every interaction**, not on request. It controls chat output only — never code, comments, or commit messages.

## Memory protocol (always follow)

This project keeps a persistent knowledge base in `.claude/memory/` (see the `auto-memory` skill at `.claude/skills/auto-memory/SKILL.md`). Use it on **every task**:

1. **Recall first.** Before starting any task, read `.claude/memory/INDEX.md` and follow the matching folder indexes down to the memory files whose descriptions/keywords match the task. Do not skip this because the task looks simple.
2. **Trust the code over memory.** If a memory contradicts what the code on the current branch shows now, the code wins — update or delete the stale memory immediately, and fix its index line.
3. **Save as you learn.** When a task surfaces a durable, non-obvious fact — a decision and its reasoning, an investigation outcome, a gotcha, a correction from the user — save it via the auto-memory rules (topic folder, frontmatter, index entry). Don't save what the code or git history already records.
4. **Keep it current.** Every memory write, update, or deletion must also update the indexes on its path. Bump the `updated:` date when editing a file.
5. **Verify before acting on memory.** Memories record what was true when written. Check the facts you will act on against the current branch. Do not look up other branches; if the current code does not confirm a memory, investigate again.

## Clarification before action

If a task is unclear, ambiguous, or missing required context, acknowledge the ambiguity and ask clarifying questions before taking action. Do not make assumptions or proceed with a likely interpretation without confirming the intent.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Type checking

Use `bun check` to type check the project. It reads `tsconfig.json` and reports the same errors as `tsc`.

- `bun check src/index.ts` checks one file and what it imports
- `bun --check src/index.ts`, `bun test --check` and `bun build --check` type check first, and do nothing else if there is an error

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
