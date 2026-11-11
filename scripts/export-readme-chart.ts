/**
 * Renders the first ```mermaid block of README.md to transparent images in docs/:
 *   architecture.svg / .png        (default theme, for light pages)
 *   architecture-dark.svg / .png   (dark theme, for dark pages)
 *   bun run docs:chart
 * Set CHROME_PATH if Chrome is not in the default macOS location.
 */import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const outDir = path.join(root, "docs");
const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PNG_SCALE = 2;

const readme = await Bun.file(path.join(root, "README.md")).text();
const code = /```mermaid\n([\s\S]*?)```/.exec(readme)?.[1];
if (!code) throw new Error("README.md has no ```mermaid block.");

await mkdir(outDir, { recursive: true });

const VARIANTS = [
  { theme: "default", file: "architecture" },
  { theme: "dark", file: "architecture-dark" },
] as const;

const browser = await chromium.launch({ executablePath: chrome });
try {
  const page = await browser.newPage({ deviceScaleFactor: PNG_SCALE });
  // No background colour anywhere, so the images are transparent.
  await page.setContent('<body style="margin:0;background:transparent"><div id="host"></div></body>');
  await page.addScriptTag({ path: path.join(root, "node_modules/mermaid/dist/mermaid.min.js") });

  for (const { theme, file } of VARIANTS) {
    // Same settings as src/lib/mermaid-runtime.ts: plain SVG text, so the image looks the same everywhere.
    const svg = await page.evaluate(
      async ([source, diagramTheme]) => {
        const mermaid = (window as unknown as { mermaid: typeof import("mermaid").default }).mermaid;
        mermaid.initialize({
          startOnLoad: false,
          theme: diagramTheme,
          htmlLabels: false,
          securityLevel: "strict",
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          flowchart: { htmlLabels: false, useMaxWidth: false, wrappingWidth: 400 },
        } as Parameters<typeof mermaid.initialize>[0]);
        const { svg } = await mermaid.render("architecture", source);
        document.getElementById("host")!.innerHTML = svg;
        return svg;
      },
      [code, theme] as const,
    );
    await Bun.write(path.join(outDir, `${file}.svg`), svg);
    await page.locator("#host svg").screenshot({ path: path.join(outDir, `${file}.png`), omitBackground: true });
  }
} finally {
  await browser.close();
}
console.log("Wrote transparent docs/architecture(.|-dark).svg and .png");
