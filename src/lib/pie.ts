import { findHeaderLine } from "@/lib/diagram-type";

export interface PieSlice {
  label: string;
  value: number;
}

export interface PieModel {
  /** Everything before the `pie` keyword (front matter, directives, comments). */
  prefix: string;
  showData: boolean;
  title: string;
  slices: PieSlice[];
  /** Lines this editor does not understand (accessibility titles, comments, …). Kept as they are. */
  extra: string[];
}

const SLICE = /^\s*(?:"([^"]*)"|'([^']*)')\s*:\s*(-?\d+(?:\.\d+)?)\s*$/;

export function parsePie(code: string): PieModel | null {
  const lines = code.split(/\r?\n/);
  const header = findHeaderLine(lines);
  if (header === -1) return null;
  const head = /^\s*pie\b(.*)$/.exec(lines[header] ?? "");
  if (!head) return null;

  let rest = (head[1] ?? "").trim();
  const showData = /^showData\b/.test(rest);
  if (showData) rest = rest.replace(/^showData\b/, "").trim();
  let title = /^title\s+(.*)$/.exec(rest)?.[1]?.trim() ?? "";

  const slices: PieSlice[] = [];
  const extra: string[] = [];
  for (const line of lines.slice(header + 1)) {
    if (line.trim() === "") continue;
    const slice = SLICE.exec(line);
    if (slice) {
      slices.push({ label: slice[1] ?? slice[2] ?? "", value: Number(slice[3]) });
      continue;
    }
    const titleLine = /^\s*title\s+(.*)$/.exec(line);
    if (titleLine) title = (titleLine[1] ?? "").trim();
    else extra.push(line.trim());
  }
  return { prefix: lines.slice(0, header).join("\n"), showData, title, slices, extra };
}

export function serializePie(model: PieModel): string {
  const head = ["pie", model.showData ? "showData" : "", model.title ? `title ${model.title}` : ""].filter(Boolean).join(" ");
  const body = model.slices.map((s) => `    "${s.label.replace(/"/g, "'")}" : ${Number.isFinite(s.value) ? s.value : 0}`);
  const extra = model.extra.map((line) => `    ${line}`);
  const text = [head, ...extra, ...body].join("\n") + "\n";
  return model.prefix ? model.prefix.replace(/\s*$/, "\n") + text : text;
}
