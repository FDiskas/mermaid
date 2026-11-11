import type { RenderedDiagram } from "@/lib/mermaid-runtime";

const MAX_CANVAS_SIDE = 16384;

export interface PngOptions {
  /** 1–4: pixels per diagram unit. Lowered automatically when the canvas would be too large. */
  scale: number;
  /** Background colour, or null for a transparent PNG. */
  background: string | null;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The browser could not draw the SVG."));
    image.src = url;
  });
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function svgToBlob(diagram: { svg: string }): Blob {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${diagram.svg}`;
  return new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
}

/**
 * A few Mermaid diagrams (e.g. user journey) always draw their labels as HTML inside <foreignObject>.
 * Browsers refuse to read pixels back from such an SVG, so a PNG could not be made. This swaps each
 * <foreignObject> for plain SVG <text> that has the same position, colour and font.
 */
export function replaceForeignObjects(svg: string): string {
  if (!svg.includes("<foreignObject")) return svg;
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none";
  host.innerHTML = svg;
  document.body.append(host);
  try {
    host.querySelectorAll("foreignObject").forEach((box) => {
      const source = box.querySelector(".label, span, p, div") ?? box;
      const style = getComputedStyle(source);
      const lines = source.innerHTML
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length > 0) {
        const x = Number(box.getAttribute("x") ?? 0) + Number(box.getAttribute("width") ?? 0) / 2;
        const y = Number(box.getAttribute("y") ?? 0) + Number(box.getAttribute("height") ?? 0) / 2;
        const lineHeight = Number.parseFloat(style.fontSize) * 1.2 || 16;
        const text = document.createElementNS(SVG_NS, "text");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "central");
        text.setAttribute("fill", style.color);
        text.setAttribute("font-family", style.fontFamily);
        text.setAttribute("font-size", style.fontSize);
        text.setAttribute("font-weight", style.fontWeight);
        lines.forEach((line, index) => {
          const tspan = document.createElementNS(SVG_NS, "tspan");
          tspan.setAttribute("x", String(x));
          tspan.setAttribute("y", String(y + (index - (lines.length - 1) / 2) * lineHeight));
          tspan.textContent = line;
          text.append(tspan);
        });
        box.replaceWith(text);
      } else {
        box.replaceWith();
      }
    });
    return new XMLSerializer().serializeToString(host.querySelector("svg")!);
  } finally {
    host.replaceChildren();
    host.replaceWith();
  }
}

export async function svgToPngBlob(diagram: RenderedDiagram, { scale, background }: PngOptions): Promise<Blob> {
  const factor = Math.max(0.1, Math.min(scale, MAX_CANVAS_SIDE / diagram.width, MAX_CANVAS_SIDE / diagram.height));
  const url = URL.createObjectURL(svgToBlob({ svg: replaceForeignObjects(diagram.svg) }));
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(diagram.width * factor);
    canvas.height = Math.round(diagram.height * factor);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available.");
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed."))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyPngToClipboard(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export function exportFilename(extension: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `mermaid-drawing-${stamp}.${extension}`;
}
