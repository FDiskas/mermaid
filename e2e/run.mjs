/**
 * End-to-end checks that drive the real app in Chrome.
 *   bun e2e/run.mjs [baseUrl]          (start the app first: `bun dev`)
 * Set CHROME_PATH if Chrome is not in the default macOS location.
 */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000/";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = new URL("./out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const BLOCKS = ["flowchart", "pie", "templates", "zoom", "app", "mobile"];
const ONLY = process.env.ONLY;
if (!ONLY) {
  // A fresh browser per block keeps long runs reliable.
  let failed = 0;
  for (const block of BLOCKS) {
    console.log(`\n# ${block}`);
    const run = Bun.spawnSync(["bun", import.meta.path, BASE], { env: { ...process.env, ONLY: block }, stdout: "inherit", stderr: "inherit" });
    if (run.exitCode !== 0) failed++;
  }
  console.log(failed ? `\n${failed} block(s) failed` : "\nAll blocks passed");
  process.exit(failed ? 1 : 0);
}
const results = [];
let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    results.push(`  ok    ${name}`);
    console.log(results.at(-1));
  } catch (error) {
    failures++;
    results.push(`  FAIL  ${name}\n        ${String(error.message).split("\n")[0]}`);
    console.log(results.at(-1));
  }
}
const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

const browser = await chromium.launch({ executablePath: CHROME });

async function open({ code, theme = "light", language, viewport = { width: 1600, height: 900 } } = {}) {
  const context = await browser.newContext({ viewport, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
  await context.addInitScript(
    ({ code, theme, language }) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("mermaid-drawing:theme", JSON.stringify(theme));
      if (code !== undefined) localStorage.setItem("mermaid-drawing:code", JSON.stringify(code));
      if (language) localStorage.setItem("mermaid-drawing:language", JSON.stringify(language));
    },
    { code, theme, language },
  );
  const page = await context.newPage();
  page.errors = [];
  page.on("crash", () => console.log("  !! PAGE CRASHED"));
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && page.errors.push(m.text()));
  await page.goto(BASE);
  await page.waitForSelector("[data-testid=diagram] svg", { state: "attached", timeout: 30000 });
  await page.waitForTimeout(300);
  return page;
}

const editorText = (page) => page.$$eval(".cm-line", (lines) => lines.map((l) => l.textContent).join("\n"));
const node = (page, text) => page.locator("g.node", { hasText: text }).first();
async function waitCode(page, predicate, label) {
  const deadline = Date.now() + 8000;
  let last = "";
  while (Date.now() < deadline) {
    last = await editorText(page);
    if (predicate(last)) return last;
    await page.waitForTimeout(100);
  }
  throw new Error(`${label}: code never matched. Last code:\n${last}`);
}
const svgText = (page) => page.$eval("[data-testid=diagram]", (el) => el.textContent);

const FLOW = `flowchart TD
    A(["Start"]) --> B["Process request"]
    B --> C{"Valid?"}
    C -->|Yes| D(["Done"])
    C -->|No| B
`;

/* ---------- Flowchart: visual editing ---------- */
if (ONLY === "flowchart") {
  const page = await open({ code: FLOW });
  await page.screenshot({ path: OUT + "01-flowchart.png" });

  await check("clicking a node opens the node inspector", async () => {
    await node(page, "Process request").click();
    await page.waitForSelector("[data-testid=node-inspector]");
    assert((await page.inputValue("#node-label")) === "Process request", "label field should show the node label");
  });

  await check("selected node is highlighted in the preview", async () => {
    const stroke = await node(page, "Process request").evaluate((g) => getComputedStyle(g.querySelector("rect, path, polygon")).stroke);
    assert(stroke.includes("59, 130, 246"), `expected blue selection stroke, got ${stroke}`);
    await page.screenshot({ path: OUT + "02-selected.png" });
  });

  await check("editing the label rewrites the code and the diagram", async () => {
    await page.fill("#node-label", "Handle request");
    await waitCode(page, (c) => c.includes('B["Handle request"]'), "label");
    await page.waitForFunction(() => document.querySelector("[data-testid=diagram]").textContent.includes("Handle request"));
  });

  await check("changing the shape rewrites the code", async () => {
    await page.click("[data-shape=hexagon]");
    await waitCode(page, (c) => c.includes('B{{"Handle request"}}'), "shape");
    await page.click("[data-shape=cylinder]");
    await waitCode(page, (c) => c.includes('B[("Handle request")]'), "shape 2");
  });

  await check("fill colour is written as a style line and drawn", async () => {
    await page.locator("input[type=color]").first().fill("#ff8800");
    await waitCode(page, (c) => /style B .*fill:#ff8800/.test(c), "fill");
    await page.waitForTimeout(500);
    const fill = await node(page, "Handle request").evaluate((g) => getComputedStyle(g.querySelector("path, rect, polygon")).fill);
    assert(fill.includes("255, 136, 0"), `node should be orange, got ${fill}`);
  });

  await check("text colour and border width apply", async () => {
    await page.locator("input[type=color]").nth(2).fill("#0000ff");
    await page.fill("input[type=number]", "5");
    await waitCode(page, (c) => /style B .*color:#0000ff/.test(c) && /stroke-width:5px/.test(c), "text color + width");
  });

  await check("'Add connected node' adds a node and an arrow", async () => {
    await page.getByRole("button", { name: /Add connected node/ }).click();
    const code = await waitCode(page, (c) => /B --> E\b/.test(c), "connected node");
    assert(/\n\s+E\["New node"\]/.test(code), "new node declaration missing");
    await page.waitForFunction(() => document.querySelector("[data-testid=diagram]").textContent.includes("New node"));
    assert((await page.inputValue("#node-label")) === "New node", "the new node should be selected");
  });

  await check("undo removes the added node, redo brings it back", async () => {
    await page.click("[data-testid=undo]");
    await waitCode(page, (c) => !c.includes("New node"), "undo");
    await page.click("[data-testid=redo]");
    await waitCode(page, (c) => c.includes("New node"), "redo");
  });

  await check("double-click renames a node inline", async () => {
    await node(page, "Start").dblclick();
    const field = page.locator("[data-testid=inline-editor]");
    await field.waitFor();
    await field.fill("Begin");
    await field.press("Enter");
    await waitCode(page, (c) => c.includes('A(["Begin"])'), "inline rename");
  });

  await check("connect tool draws a new arrow between two nodes", async () => {
    await page.click("[data-testid=preview-canvas]", { position: { x: 5, y: 400 } }); // nothing selected
    await page.click("[data-testid=tool-connect]");
    await page.waitForSelector("[data-testid=connect-hint]");
    assert((await page.textContent("[data-testid=connect-hint]")).includes("starts from"), "hint should ask for the source node");
    await node(page, "Begin").click();
    assert((await page.textContent("[data-testid=connect-hint]")).includes("target"), "hint should ask for the target node");
    await node(page, "Done").click();
    await waitCode(page, (c) => /A --> D\b/.test(c), "connect");
    await page.waitForSelector("[data-testid=edge-inspector]");
    assert(!(await page.$("[data-testid=connect-hint]")), "connect mode should end after one arrow");
    await page.screenshot({ path: OUT + "03-edge-selected.png" });
  });

  await check("edge inspector: label, dotted line, reverse", async () => {
    await page.fill("#edge-label", "skip");
    await waitCode(page, (c) => /A -->\|"skip"\| D/.test(c), "edge label");
    await page.getByRole("radio", { name: "Dotted" }).click().catch(() => page.getByRole("button", { name: "Dotted" }).click());
    await waitCode(page, (c) => /A -\.->\|"skip"\| D/.test(c), "dotted");
    await page.getByRole("button", { name: /Reverse direction/ }).click();
    await waitCode(page, (c) => /D -\.->\|"skip"\| A/.test(c), "reverse");
  });

  await check("clicking an arrow in the preview selects it", async () => {
    await page.click("[data-testid=preview-canvas]", { position: { x: 5, y: 400 } }); // empty area clears selection
    await page.waitForSelector("[data-testid=diagram-inspector]");
    const box = await page.locator(".mv-hit").first().boundingBox();
    assert(box, "edge hit area missing");
    const handle = await page.locator(".mv-hit").first().elementHandle();
    const point = await handle.evaluate((p) => {
      const pt = p.getPointAtLength(p.getTotalLength() / 2);
      const m = p.getScreenCTM();
      return { x: m.a * pt.x + m.c * pt.y + m.e, y: m.b * pt.x + m.d * pt.y + m.f };
    });
    await page.mouse.click(point.x, point.y);
    await page.waitForSelector("[data-testid=edge-inspector]");
  });

  await check("Delete key removes the selected edge", async () => {
    const before = (await editorText(page)).split("\n").filter((l) => l.includes("-->")).length;
    await page.keyboard.press("Delete");
    await page.waitForSelector("[data-testid=diagram-inspector]");
    await waitCode(page, (c) => c.split("\n").filter((l) => l.includes("-->")).length === before - 1, "delete edge");
  });

  await check("deleting a node removes its arrows", async () => {
    await node(page, "Done").click();
    await page.getByRole("button", { name: /^Delete$/ }).click();
    const code = await waitCode(page, (c) => !c.includes('"Done"'), "delete node");
    assert(!/\bD\b/.test(code.replace(/"[^"]*"/g, "")), "arrows to the deleted node should be gone");
  });

  await check("direction toggle changes flowchart direction", async () => {
    await page.click("[data-testid=preview-canvas]", { position: { x: 5, y: 400 } });
    await page.getByRole("radio", { name: "Left to right" }).click().catch(() => page.getByRole("button", { name: "Left to right" }).click());
    await waitCode(page, (c) => c.startsWith("flowchart LR"), "direction");
  });

  await check("typing in the code editor updates the preview and the model", async () => {
    await page.click(".cm-content");
    await page.keyboard.press("Meta+A");
    await page.keyboard.insertText("flowchart TD\n  X[Hello] --> Y[World]\n");
    await page.waitForFunction(() => document.querySelector("[data-testid=diagram]").textContent.includes("World"));
    await node(page, "World").click();
    await page.waitForSelector("[data-testid=node-inspector]");
    assert((await page.inputValue("#node-label")) === "World", "inspector should follow typed code");
  });

  await check("a syntax error shows a message and keeps the last diagram", async () => {
    await page.click(".cm-content");
    await page.keyboard.press("Meta+A");
    await page.keyboard.insertText("flowchart TD\n  X[Hello --> Y\n");
    await page.waitForSelector("[data-testid=render-error]", { timeout: 5000 });
    assert((await page.locator("[data-testid=diagram] svg").count()) === 1, "last good diagram should stay visible");
    await page.screenshot({ path: OUT + "04-error.png" });
  });
  assert(page.errors.length === 0, "console errors: " + page.errors.join(" | "));
  await page.context().close();

  const multi = await open({ code: FLOW });
  await check("Shift-click selects several nodes and the Group button wraps them", async () => {
    await node(multi, "Process request").click();
    await node(multi, "Valid?").click({ modifiers: ["Shift"] });
    await multi.waitForSelector("[data-testid=multi-inspector]");
    const highlighted = await multi.$$eval("g.node.mv-selected", (els) => els.length);
    assert(highlighted === 2, `expected 2 highlighted nodes, got ${highlighted}`);
    await multi.screenshot({ path: OUT + "06-multi-select.png" });
    await multi.click("[data-testid=group-selected]");
    const code = await waitCode(multi, (c) => c.includes("subgraph G1"), "group");
    assert(/subgraph G1\["New group"\]\n\s+B\n\s+C\n\s+end/.test(code), "group should hold B and C:\n" + code);
    await multi.waitForSelector("[data-testid=group-inspector]");
    await multi.waitForSelector("g.cluster.mv-selected");
    await multi.screenshot({ path: OUT + "07-grouped.png" });
  });
  await check("Shift-click again removes a node from the selection", async () => {
    await multi.keyboard.press("Escape");
    await node(multi, "Start").click();
    await node(multi, "Done").click({ modifiers: ["Shift"] });
    await node(multi, "Done").click({ modifiers: ["Shift"] });
    await multi.waitForSelector("[data-testid=node-inspector]");
  });
  await check("ungroup brings the nodes back to the top level", async () => {
    await multi.locator("g.cluster").first().locator(".cluster-label, rect").first().click({ force: true });
    await multi.waitForSelector("[data-testid=group-inspector]");
    await multi.getByRole("button", { name: /ungroup/i }).click();
    await waitCode(multi, (c) => !c.includes("subgraph"), "ungroup");
  });
  assert(multi.errors.length === 0, "console errors: " + multi.errors.join(" | "));
  await multi.context().close();
}

/* ---------- Pie chart + export ---------- */
if (ONLY === "pie") {
  const PIE = `pie showData title Time Distribution\n    "Coding" : 40\n    "Debugging" : 25\n    "Learning" : 20\n    "Coffee Break" : 15\n`;
  const page = await open({ code: PIE, theme: "dark" });
  await page.screenshot({ path: OUT + "05-pie-dark.png" });

  await check("pie inspector edits slices", async () => {
    await page.waitForSelector("[data-testid=pie-inspector]");
    const rows = page.locator("[data-testid=pie-slice]");
    assert((await rows.count()) === 4, "should list 4 slices");
    await rows.nth(0).locator("input").nth(1).fill("55");
    await waitCode(page, (c) => c.includes('"Coding" : 55'), "slice value");
    await page.getByRole("button", { name: /Add slice/ }).click();
    await waitCode(page, (c) => c.includes('"New node" : 10'), "add slice");
    await rows.nth(4).getByRole("button").click();
    await waitCode(page, (c) => !c.includes("New node"), "delete slice");
  });

  async function exportPng({ scale, transparent }) {
    await page.click("[data-testid=export-trigger]");
    await page.getByRole("radio", { name: `${scale}x`, exact: true }).click().catch(() => page.getByRole("button", { name: `${scale}x`, exact: true }).click());
    const box = page.locator("[data-testid=export-transparent]");
    if ((await box.getAttribute("data-state")) !== (transparent ? "checked" : "unchecked")) await box.click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("[data-testid=export-png]")]);
    const file = OUT + `export-${scale}x-${transparent ? "transparent" : "solid"}.png`;
    await download.saveAs(file);
    await page.waitForSelector("[role=menu]", { state: "detached" });
    return file;
  }
  const readPng = async (file) => {
    const bytes = await Bun.file(file).bytes();
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    return { signature: [...bytes.slice(0, 8)].join(","), width: view.getUint32(16), height: view.getUint32(20) };
  };
  const pixel = (file, x, y) =>
    page.evaluate(
      async ({ b64, x, y }) => {
        const img = new Image();
        img.src = "data:image/png;base64," + b64;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        return [...ctx.getImageData(x, y, 1, 1).data];
      },
      { b64: readFileSync(file).toString("base64"), x, y },
    );

  let file1, file3;
  await check("PNG export at 1x is a valid PNG with the diagram's size", async () => {
    file1 = await exportPng({ scale: 1, transparent: false });
    const png = await readPng(file1);
    assert(png.signature === "137,80,78,71,13,10,26,10", "not a PNG");
    const svgSize = await page.$eval("[data-testid=diagram] svg", (s) => [Number(s.getAttribute("width")), Number(s.getAttribute("height"))]);
    assert(png.width === svgSize[0] && png.height === svgSize[1], `size ${png.width}x${png.height} vs svg ${svgSize}`);
  });
  await check("PNG export at 3x is three times larger", async () => {
    file3 = await exportPng({ scale: 3, transparent: false });
    const a = await readPng(file1);
    const b = await readPng(file3);
    assert(b.width === a.width * 3 && b.height === a.height * 3, `${b.width}x${b.height} vs ${a.width}x${a.height}`);
  });
  await check("solid export has a background; the diagram is actually drawn", async () => {
    const corner = await pixel(file3, 2, 2);
    assert(corner[3] === 255, `corner should be opaque, got ${corner}`);
    const png = await readPng(file3);
    const colors = new Set();
    for (let i = 0; i < 40; i++) colors.add((await pixel(file3, Math.floor((png.width * (i + 1)) / 41), Math.floor(png.height / 2))).join());
    assert(colors.size > 3, "image looks blank (only " + colors.size + " distinct colours)");
  });
  await check("transparent export has a transparent corner", async () => {
    const file = await exportPng({ scale: 2, transparent: true });
    const corner = await pixel(file, 2, 2);
    assert(corner[3] === 0, `corner alpha should be 0, got ${corner}`);
  });
  await check("SVG export downloads valid SVG", async () => {
    await page.click("[data-testid=export-trigger]");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("[data-testid=export-svg]")]);
    const file = OUT + "export.svg";
    await download.saveAs(file);
    const text = await Bun.file(file).text();
    assert(text.includes("<svg") && text.includes("xmlns"), "not an SVG");
    await page.waitForSelector("[role=menu]", { state: "detached" });
  });
  await check("copy image puts a PNG on the clipboard", async () => {
    await page.click("[data-testid=export-trigger]");
    await page.click("[data-testid=export-copy]");
    await page.waitForSelector("[data-testid=flash]");
    const type = await page.evaluate(async () => (await navigator.clipboard.read())[0].types.join());
    assert(type.includes("image/png"), "clipboard has " + type);
  });
  assert(page.errors.length === 0, "console errors: " + page.errors.join(" | "));
  await page.context().close();
}

/* ---------- Every template: renders, exports ---------- */
if (ONLY === "templates") {
  const page = await open({});
  const kinds = ["flowchart", "sequence", "class", "state", "er", "gantt", "pie", "journey", "git", "mindmap", "timeline", "quadrant"];
  for (const kind of kinds) {
    await check(`template '${kind}' renders and exports to PNG`, async () => {
      await page.click("[data-testid=template-trigger]");
      await page.click(`[data-testid=template-${kind}]`);
      await page.waitForTimeout(900);
      assert(!(await page.$("[data-testid=render-error]")), "render error");
      const size = await page.$eval("[data-testid=diagram] svg", (s) => [s.getAttribute("width"), s.getAttribute("height")]);
      assert(size[0] && size[1], "svg has no size");
      await page.click("[data-testid=export-trigger]");
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }), page.click("[data-testid=export-png]")]);
      const file = OUT + `template-${kind}.png`;
      await download.saveAs(file);
      assert((await Bun.file(file).size) > 1500, "PNG is suspiciously small");
      const image = await Bun.file(file).bytes();
      assert(image[0] === 137 && image[1] === 80, "not a PNG");
      await page.waitForSelector("[role=menu]", { state: "detached" });
    });
  }
  await check("non-flowchart/pie diagrams explain the visual editor limits", async () => {
    await page.click("[data-testid=template-trigger]");
    await page.click("[data-testid=template-sequence]");
    await page.waitForTimeout(500);
    const text = await page.textContent("[data-testid=inspector]");
    assert(/flowcharts and pie charts/.test(text), "unsupported message missing");
  });
  await page.context().close();
}

/* ---------- Pan, zoom, fit ---------- */
if (ONLY === "zoom") {
  const page = await open({ code: FLOW });
  const scaleOf = () => page.$eval("[data-testid=preview-title]", (e) => Number(/\((\d+)%\)/.exec(e.textContent)[1]));
  await check("zoom buttons change the scale and fit restores it", async () => {
    const fit = await scaleOf();
    await page.click("[data-testid=zoom-in]");
    const zoomed = await scaleOf();
    assert(zoomed > fit, `${zoomed} should exceed ${fit}`);
    await page.click("[data-testid=zoom-out]");
    await page.click("[data-testid=zoom-out]");
    assert((await scaleOf()) < fit, "zoom out failed");
    await page.click("[data-testid=zoom-fit]");
    assert(Math.abs((await scaleOf()) - fit) <= 1, "fit should return to the original scale");
  });
  await check("dragging the canvas pans without selecting", async () => {
    const before = await page.$eval("[data-testid=diagram]", (e) => e.style.transform);
    await page.mouse.move(900, 600);
    await page.mouse.down();
    await page.mouse.move(960, 640, { steps: 5 });
    await page.mouse.up();
    const after = await page.$eval("[data-testid=diagram]", (e) => e.style.transform);
    assert(before !== after, "transform should change");
    assert(!(await page.$("[data-testid=node-inspector]")), "panning must not select");
  });
  await page.context().close();

  await check("two-finger pinch zooms on a touch screen, then one finger pans", async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    await context.addInitScript((code) => localStorage.setItem("mermaid-drawing:code", JSON.stringify(code)), FLOW);
    const touchPage = await context.newPage();
    await touchPage.goto(BASE);
    await touchPage.getByRole("tab").nth(1).click();
    await touchPage.waitForSelector("[data-testid=diagram]", { state: "visible", timeout: 30000 });
    await touchPage.waitForTimeout(300);
    const cdp = await context.newCDPSession(touchPage);
    const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
    const view = () =>
      touchPage.$eval("[data-testid=diagram]", (e) => {
        const [x, y, k] = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec(e.style.transform).slice(1).map(Number);
        return { x, y, k };
      });
    const box = await (await touchPage.$("[data-testid=preview-canvas]")).boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const before = await view();
    await touch("touchStart", [[cx - 40, cy], [cx + 40, cy]]);
    for (let i = 1; i <= 8; i++) await touch("touchMove", [[cx - 40 - i * 10, cy], [cx + 40 + i * 10, cy]]);
    await touch("touchEnd", []);
    const zoomed = await view();
    assert(zoomed.k > before.k * 2, `pinch should zoom in: ${before.k} -> ${zoomed.k}`);

    await touch("touchStart", [[cx, cy]]);
    for (let i = 1; i <= 5; i++) await touch("touchMove", [[cx + i * 10, cy]]);
    await touch("touchEnd", []);
    const panned = await view();
    assert(panned.x > zoomed.x && panned.k === zoomed.k, "one finger should pan without zooming");
    await context.close();
  });
}

/* ---------- Language, theme, history, share ---------- */
if (ONLY === "app") {
  const page = await open({ code: FLOW });
  await check("language switch translates the UI and persists", async () => {
    await page.click("[data-testid=language-select]");
    await page.getByRole("option", { name: "Lietuvių" }).click();
    await page.waitForFunction(() => document.body.textContent.includes("Išvalyti"));
    await page.screenshot({ path: OUT + "06-lithuanian.png" });
    await page.reload();
    await page.waitForSelector("[data-testid=diagram] svg");
    assert((await page.textContent("[data-testid=clear]")).includes("Išvalyti"), "language should persist after reload");
    assert((await page.getAttribute("html", "lang")) === "lt", "html lang attribute");
  });
  await check("theme toggle switches to dark and persists", async () => {
    await page.click("[data-testid=theme-toggle]");
    assert(await page.$eval("html", (h) => h.classList.contains("dark")), "dark class");
    await page.waitForTimeout(500);
    await page.screenshot({ path: OUT + "07-dark.png" });
    await page.reload();
    await page.waitForSelector("[data-testid=diagram] svg");
    assert(await page.$eval("html", (h) => h.classList.contains("dark")), "dark should persist");
  });
  await check("the document is stored locally and survives a reload", async () => {
    await page.click(".cm-content");
    await page.keyboard.press("Meta+A");
    await page.keyboard.insertText("flowchart TD\n  P[Persist me] --> Q\n");
    await page.waitForFunction(() => document.querySelector("[data-testid=diagram]").textContent.includes("Persist me"));
    await page.reload();
    await page.waitForFunction(() => document.querySelector("[data-testid=diagram]")?.textContent.includes("Persist me"));
  });
  await check("history keeps snapshots and restores them", async () => {
    await page.waitForTimeout(3300);
    await page.click(".cm-content");
    await page.keyboard.press("Meta+A");
    await page.keyboard.insertText("flowchart TD\n  Z1 --> Z2\n");
    await page.waitForTimeout(3300);
    await page.click("[data-testid=history-trigger]");
    const items = page.locator("[data-testid=history-list] li");
    assert((await items.count()) >= 2, "expected 2 snapshots, got " + (await items.count()));
    await items.last().getByRole("button").first().click();
    await page.waitForFunction(() => document.querySelector("[data-testid=diagram]")?.textContent.includes("Persist me") || document.querySelector("[data-testid=diagram]")?.textContent.includes("Process request"));
  });
  await check("share link reopens the same diagram in a fresh browser", async () => {
    await page.click("[data-testid=share]");
    await page.waitForSelector("[data-testid=flash]");
    const url = await page.evaluate(() => navigator.clipboard.readText());
    assert(url.includes("#d="), "link should contain the diagram: " + url);
    const expected = await editorText(page);
    const other = await open({ code: "flowchart TD\n  Old --> Thing\n" });
    await other.goto(url);
    await other.waitForFunction(() => !document.querySelector("[data-testid=diagram]")?.textContent.includes("Old"), null, { timeout: 8000 });
    const got = await editorText(other);
    assert(got === expected, "shared code differs:\n" + got);
    await other.context().close();
  });
  await check("clear empties the editor and can be undone", async () => {
    await page.click("[data-testid=clear]");
    await waitCode(page, (c) => c.trim() === "", "clear");
    await page.click("[data-testid=editor-undo]");
    await waitCode(page, (c) => c.trim() !== "", "undo clear");
  });
  await page.context().close();
}

/* ---------- Small screen ---------- */
if (ONLY === "mobile") {
  await check("mobile layout: tabs switch panels, visual editor does not squash the diagram", async () => {
    const p = await open({ code: FLOW, viewport: { width: 390, height: 800 } });
    await p.getByRole("tab").nth(1).click();
    await p.waitForSelector("[data-testid=preview-canvas]", { state: "visible" });
    const width = await p.$eval("[data-testid=preview-canvas]", (e) => e.getBoundingClientRect().width);
    assert(width > 350, `canvas is only ${width}px wide`);
    await node(p, "Process request").click().catch(() => {});
    await p.click("[data-testid=inspector-toggle]");
    await p.waitForSelector("[data-testid=inspector]");
    await p.screenshot({ path: OUT + "08-mobile.png" });
    await p.context().close();
  });
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
