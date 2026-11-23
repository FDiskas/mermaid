import { findHeaderLine } from "@/lib/diagram-type";

export interface JourneyTask {
  name: string;
  /** Satisfaction from 1 to 5. */
  score: number;
  actors: string[];
}

export interface JourneySection {
  /** `null` for the tasks written before the first `section` line. Only the first section can have no title. */
  title: string | null;
  tasks: JourneyTask[];
}

export interface JourneyModel {
  /** Everything before the `journey` keyword (front matter, directives, comments). */
  prefix: string;
  title: string;
  sections: JourneySection[];
  /** Lines this editor does not understand (accessibility titles, comments, …). Kept as they are. */
  extra: string[];
}

export const MIN_SCORE = 1;
export const MAX_SCORE = 5;

const INDENT = "    ";
/** Written in place of an empty name, so the line keeps its meaning when the code is parsed again. */
const EMPTY_NAME = "…";
const TASK = /^([^:]+):\s*(\d+)\s*(?::\s*(.*))?$/;

const splitActors = (text: string) =>
  text
    .split(",")
    .map((actor) => actor.trim())
    .filter(Boolean);

export function parseJourney(code: string): JourneyModel | null {
  const lines = code.split(/\r?\n/);
  const header = findHeaderLine(lines);
  if (header === -1 || !/^\s*journey\b/.test(lines[header] ?? "")) return null;

  const model: JourneyModel = { prefix: lines.slice(0, header).join("\n"), title: "", sections: [], extra: [] };
  let section: JourneySection | null = null;

  for (const raw of lines.slice(header + 1)) {
    const line = raw.trim();
    if (line === "") continue;
    const sectionLine = /^section\s+(.*)$/.exec(line);
    const titleLine = /^title\s+(.*)$/.exec(line);
    const task = line.startsWith("%%") || /^acc(Title|Descr)\b/.test(line) ? null : TASK.exec(line);
    if (sectionLine) {
      section = { title: (sectionLine[1] ?? "").trim(), tasks: [] };
      model.sections.push(section);
    } else if (titleLine) {
      model.title = (titleLine[1] ?? "").trim();
    } else if (task) {
      if (!section) {
        section = { title: null, tasks: [] };
        model.sections.push(section);
      }
      section.tasks.push({ name: (task[1] ?? "").trim(), score: Number(task[2]), actors: splitActors(task[3] ?? "") });
    } else {
      model.extra.push(line);
    }
  }
  return model;
}

export function serializeJourney(model: JourneyModel): string {
  const lines = ["journey"];
  if (model.title) lines.push(`${INDENT}title ${model.title}`);
  lines.push(...model.extra.map((line) => `${INDENT}${line}`));

  for (const section of model.sections) {
    const named = section.title !== null;
    if (named) lines.push(`${INDENT}section ${(section.title ?? "").trim() || EMPTY_NAME}`);
    else if (section.tasks.length === 0) continue;
    const indent = named ? INDENT.repeat(2) : INDENT;
    for (const task of section.tasks) {
      const score = Math.min(MAX_SCORE, Math.max(MIN_SCORE, Math.round(task.score) || MIN_SCORE));
      const actors = task.actors.map((actor) => actor.trim()).filter(Boolean);
      const name = task.name.replace(/:/g, " ").trim() || EMPTY_NAME;
      lines.push(`${indent}${name}: ${score}${actors.length > 0 ? `: ${actors.join(", ")}` : ""}`);
    }
  }
  const text = lines.join("\n") + "\n";
  return model.prefix ? model.prefix.replace(/\s*$/, "\n") + text : text;
}
