import { findHeaderLine } from "@/lib/diagram-type";

/** Flags a task can carry before its id and dates. */
export const GANTT_TAGS = ["crit", "done", "active", "milestone"] as const;
export type GanttTag = (typeof GANTT_TAGS)[number];

export interface GanttTask {
  name: string;
  tags: GanttTag[];
  /** Needs a start. Without a start it is not written, because Mermaid reads two values as start and end. */
  id: string;
  /** A date, or `after <id>`. Empty means the task starts when the one before ends. */
  start: string;
  /** A date or a duration (`30d`). */
  end: string;
}

export interface GanttSection {
  /** `null` for the tasks written before the first `section` line. Only the first section can have no title. */
  title: string | null;
  tasks: GanttTask[];
}

export interface GanttModel {
  /** Everything before the `gantt` keyword (front matter, directives, comments). */
  prefix: string;
  title: string;
  dateFormat: string;
  axisFormat: string;
  sections: GanttSection[];
  /** Other settings and comments (`excludes weekends`, `todayMarker off`, `click …`). Kept, but written before the sections. */
  extra: string[];
}

const INDENT = "    ";
/** Written in place of an empty name, so the line keeps its meaning when the code is parsed again. */
const EMPTY_NAME = "…";
const DEFAULT_DURATION = "1d";

const SETTING = /^(excludes|includes|todayMarker|tickInterval|weekday|weekend|inclusiveEndDates|topAxis|accTitle|accDescr|click|vert)\b/;
const TASK = /^([^:]+?)\s*:\s*(.*)$/;

const isTag = (token: string): token is GanttTag => (GANTT_TAGS as readonly string[]).includes(token);

function parseTask(name: string, spec: string): GanttTask {
  const tokens = spec.split(",").map((token) => token.trim()).filter(Boolean);
  const tags: GanttTag[] = [];
  while (tokens.length > 0 && isTag(tokens[0] ?? "")) tags.push(tokens.shift() as GanttTag);
  const task: GanttTask = { name: name.trim(), tags, id: "", start: "", end: "" };
  if (tokens.length === 1) [task.end] = tokens as [string];
  else if (tokens.length === 2) [task.start, task.end] = tokens as [string, string];
  else if (tokens.length >= 3) [task.id, task.start, task.end] = tokens as [string, string, string];
  return task;
}

export function parseGantt(code: string): GanttModel | null {
  const lines = code.split(/\r?\n/);
  const header = findHeaderLine(lines);
  if (header === -1 || !/^\s*gantt\b/.test(lines[header] ?? "")) return null;

  const model: GanttModel = { prefix: lines.slice(0, header).join("\n"), title: "", dateFormat: "", axisFormat: "", sections: [], extra: [] };
  let section: GanttSection | null = null;

  for (const raw of lines.slice(header + 1)) {
    const line = raw.trim();
    if (line === "") continue;
    const sectionLine = /^section\s+(.*)$/.exec(line);
    const setting = /^(title|dateFormat|axisFormat)\s+(.*)$/.exec(line);
    const task = line.startsWith("%%") || SETTING.test(line) ? null : TASK.exec(line);
    if (sectionLine) {
      section = { title: (sectionLine[1] ?? "").trim(), tasks: [] };
      model.sections.push(section);
    } else if (setting) {
      model[setting[1] as "title" | "dateFormat" | "axisFormat"] = (setting[2] ?? "").trim();
    } else if (task) {
      if (!section) {
        section = { title: null, tasks: [] };
        model.sections.push(section);
      }
      section.tasks.push(parseTask(task[1] ?? "", task[2] ?? ""));
    } else {
      model.extra.push(line);
    }
  }
  return model;
}

function taskLine(task: GanttTask): string {
  const start = task.start.trim();
  const end = task.end.trim();
  const dates = [...(start && task.id.trim() ? [task.id.trim()] : []), ...(start ? [start] : []), ...(end ? [end] : [])];
  if (dates.length === 0) dates.push(DEFAULT_DURATION);
  const name = task.name.replace(/:/g, " ").trim() || EMPTY_NAME;
  return `${INDENT}${name} :${[...task.tags, ...dates].join(", ")}`;
}

export function serializeGantt(model: GanttModel): string {
  const lines = ["gantt"];
  if (model.title) lines.push(`${INDENT}title ${model.title}`);
  if (model.dateFormat) lines.push(`${INDENT}dateFormat ${model.dateFormat}`);
  if (model.axisFormat) lines.push(`${INDENT}axisFormat ${model.axisFormat}`);
  lines.push(...model.extra.map((line) => `${INDENT}${line}`));
  for (const section of model.sections) {
    if (section.title !== null) lines.push(`${INDENT}section ${section.title.trim() || EMPTY_NAME}`);
    lines.push(...section.tasks.map(taskLine));
  }
  const text = lines.join("\n") + "\n";
  return model.prefix ? model.prefix.replace(/\s*$/, "\n") + text : text;
}
