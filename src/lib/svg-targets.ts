import type { Selection } from "@/lib/flowchart/model";

/**
 * Mermaid writes ids into the SVG it renders. These helpers map between DOM elements and
 * flowchart elements, so the preview can be clicked and highlighted.
 *
 *   node     <g class="node"      id="<svg>-flowchart-<id>-<n>">
 *   edge     <path class="flowchart-link" data-id="L_<from>_<to>_<n>">
 *   label    <g class="edgeLabel"><g class="label" data-id="L_<from>_<to>_<n>">
 *   group    <g class="cluster"   id="<svg>-<id>">
 */

const NODE_ID = /^flowchart-(.+)-\d+$/;

function svgRoot(from: Element): SVGSVGElement | null {
  return from.closest("svg");
}

function nodeIdOf(node: Element, svgId: string): string | null {
  const raw = node.id.startsWith(`${svgId}-`) ? node.id.slice(svgId.length + 1) : node.id;
  return NODE_ID.exec(raw)?.[1] ?? null;
}

export function targetFromElement(element: Element | null): Selection {
  if (!element) return null;
  const root = svgRoot(element);
  if (!root) return null;

  const hit = element.closest("[data-hit-for]");
  if (hit) return { kind: "edge", id: hit.getAttribute("data-hit-for") ?? "" };

  const edgeLabel = element.closest("g.edgeLabel");
  if (edgeLabel) {
    const id = edgeLabel.querySelector("[data-id]")?.getAttribute("data-id");
    if (id) return { kind: "edge", id };
  }

  const node = element.closest("g.node");
  if (node) {
    const id = nodeIdOf(node, root.id);
    if (id) return { kind: "node", id };
  }

  const cluster = element.closest("g.cluster");
  if (cluster && cluster.id.startsWith(`${root.id}-`)) {
    return { kind: "group", id: cluster.id.slice(root.id.length + 1) };
  }
  return null;
}

export function findTargetElement(root: SVGSVGElement, selection: NonNullable<Selection>): Element | null {
  switch (selection.kind) {
    case "node":
      return [...root.querySelectorAll("g.node")].find((g) => nodeIdOf(g, root.id) === selection.id) ?? null;
    case "group":
      return root.querySelector(`g.cluster[id="${CSS.escape(`${root.id}-${selection.id}`)}"]`);
    case "edge":
      return root.querySelector(`path.flowchart-link[data-id="${CSS.escape(selection.id)}"]`);
  }
}

/** Where a label sits on screen: used to place the inline text editor. */
export function labelRectOf(root: SVGSVGElement, selection: NonNullable<Selection>): DOMRect | null {
  if (selection.kind === "edge") {
    const label = [...root.querySelectorAll("g.edgeLabel")].find(
      (g) => g.querySelector("[data-id]")?.getAttribute("data-id") === selection.id,
    );
    return (label ?? findTargetElement(root, selection))?.getBoundingClientRect() ?? null;
  }
  const element = findTargetElement(root, selection);
  if (!element) return null;
  if (selection.kind === "group") return (element.querySelector(".cluster-label") ?? element).getBoundingClientRect();
  return element.getBoundingClientRect();
}

/** Thin edges are hard to click. Add a wide invisible copy of each edge path to catch the pointer. */
export function addEdgeHitAreas(root: SVGSVGElement): void {
  root.querySelectorAll("path.flowchart-link").forEach((path) => {
    const id = path.getAttribute("data-id");
    if (!id) return;
    const hit = path.cloneNode(false) as SVGPathElement;
    for (const attr of ["id", "data-id", "data-edge", "data-et", "data-points", "marker-end", "marker-start", "style"]) {
      hit.removeAttribute(attr);
    }
    hit.setAttribute("class", "mv-hit");
    hit.setAttribute("data-hit-for", id);
    path.after(hit);
  });
}

/** Reads the fill / stroke / text colours Mermaid actually drew for an element. */
export function readRenderedColors(element: Element | null): { fill?: string; stroke?: string; color?: string } {
  if (!element) return {};
  const shape = element.matches("path.flowchart-link")
    ? element
    : element.querySelector(
        ".label-container, .label-container path, .label-container rect, :scope > rect, :scope > path, :scope > polygon, :scope > circle, rect, path, polygon, circle",
      );
  const text = element.querySelector("text, tspan");
  const shapeStyle = shape ? getComputedStyle(shape) : null;
  const textStyle = text ? getComputedStyle(text) : null;
  return {
    fill: shapeStyle?.fill,
    stroke: shapeStyle?.stroke,
    color: textStyle?.fill,
  };
}
