import { findHeaderLine } from "@/lib/diagram-type";

export interface QuadrantPoint {
  /** The name as written, including a `:::class` suffix. */
  name: string;
  /** Position from 0 to 1. */
  x: number;
  y: number;
  /** Style after the coordinates (`radius: 12, color: #ff3300`). Kept as it is. */
  style: string;
}

export interface QuadrantModel {
  /** Everything before the `quadrantChart` keyword (front matter, directives, comments). */
  prefix: string;
  title: string;
  xLeft: string;
  xRight: string;
  yBottom: string;
  yTop: string;
  /** Names of quadrant 1 (top right), 2 (top left), 3 (bottom left) and 4 (bottom right). */
  quadrants: [string, string, string, string];
  points: QuadrantPoint[];
  /** Lines this editor does not understand (`classDef`, comments, …). Kept as they are. */
  extra: string[];
}

const INDENT = "    ";
/** Written in place of an empty name, so the line keeps its meaning when the code is parsed again. */
const EMPTY_NAME = "…";

export const POINT = /^(.+?)\s*:\s*\[\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\]\s*(.*)$/;
export const AXIS = /^(x-axis|y-axis)\s+(.*)$/;
export const QUADRANT_NAME = /^quadrant-([1-4])\s+(.*)$/;
export const TITLE_LINE = /^title\s+(.*)$/;

const clampUnit = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

export function splitAxis(text: string): [string, string] {
  const [first = "", ...rest] = text.split("-->");
  return [first.trim(), rest.join("-->").trim()];
}

export function parseQuadrant(code: string): QuadrantModel | null {
  const lines = code.split(/\r?\n/);
  const header = findHeaderLine(lines);
  if (header === -1 || !/^\s*quadrantChart\b/.test(lines[header] ?? "")) return null;

  const model: QuadrantModel = {
    prefix: lines.slice(0, header).join("\n"),
    title: "",
    xLeft: "",
    xRight: "",
    yBottom: "",
    yTop: "",
    quadrants: ["", "", "", ""],
    points: [],
    extra: [],
  };

  for (const raw of lines.slice(header + 1)) {
    const line = raw.trim();
    if (line === "") continue;
    const title = TITLE_LINE.exec(line);
    const axis = AXIS.exec(line);
    const quadrant = QUADRANT_NAME.exec(line);
    const point = line.startsWith("%%") ? null : POINT.exec(line);
    if (title) {
      model.title = (title[1] ?? "").trim();
    } else if (axis) {
      const [from, to] = splitAxis(axis[2] ?? "");
      if (axis[1] === "x-axis") [model.xLeft, model.xRight] = [from, to];
      else [model.yBottom, model.yTop] = [from, to];
    } else if (quadrant) {
      model.quadrants[Number(quadrant[1]) - 1] = (quadrant[2] ?? "").trim();
    } else if (point) {
      model.points.push({ name: point[1] ?? "", x: Number(point[2]), y: Number(point[3]), style: (point[4] ?? "").trim() });
    } else {
      model.extra.push(line);
    }
  }
  return model;
}

function axisLine(keyword: string, from: string, to: string): string[] {
  if (!from && !to) return [];
  return [`${INDENT}${keyword} ${from || EMPTY_NAME}${to ? ` --> ${to}` : ""}`];
}

export function serializeQuadrant(model: QuadrantModel): string {
  const lines = ["quadrantChart"];
  if (model.title) lines.push(`${INDENT}title ${model.title}`);
  lines.push(...axisLine("x-axis", model.xLeft, model.xRight), ...axisLine("y-axis", model.yBottom, model.yTop));
  model.quadrants.forEach((name, index) => {
    if (name) lines.push(`${INDENT}quadrant-${index + 1} ${name}`);
  });
  lines.push(...model.extra.map((line) => `${INDENT}${line}`));
  for (const point of model.points) {
    const style = point.style ? ` ${point.style}` : "";
    lines.push(`${INDENT}${point.name.trim() || EMPTY_NAME}: [${clampUnit(point.x)}, ${clampUnit(point.y)}]${style}`);
  }
  const text = lines.join("\n") + "\n";
  return model.prefix ? model.prefix.replace(/\s*$/, "\n") + text : text;
}
