import { findHeaderLine } from "@/lib/diagram-type";

export interface TimelinePeriod {
  /** The time label (`2004`, `2025 Q3`, …). */
  label: string;
  events: string[];
}

export interface TimelineSection {
  /** `null` for the periods written before the first `section` line. Only the first section can have no title. */
  title: string | null;
  periods: TimelinePeriod[];
}

export interface TimelineModel {
  /** Everything before the `timeline` keyword (front matter, directives, comments). */
  prefix: string;
  title: string;
  sections: TimelineSection[];
  /** Lines this editor does not understand (accessibility titles, comments, …). Kept as they are. */
  extra: string[];
}

/** Written in place of an empty label, so the line keeps its meaning when the code is parsed again. */
const EMPTY_LABEL_PLACEHOLDER = "…";

const COLON_ENTITY = "#colon;";
const INDENT = "    ";

/** A colon splits a period from its events, so a colon inside a text is written as Mermaid's entity code. */
const encodeText = (text: string) => text.replace(/\s*\r?\n\s*/g, " ").replace(/:/g, COLON_ENTITY);
const decodeText = (text: string) => text.split(COLON_ENTITY).join(":");

export function parseTimeline(code: string): TimelineModel | null {
  const lines = code.split(/\r?\n/);
  const header = findHeaderLine(lines);
  if (header === -1) return null;
  const head = /^\s*timeline\b(.*)$/.exec(lines[header] ?? "");
  if (!head) return null;

  const model: TimelineModel = { prefix: lines.slice(0, header).join("\n"), title: "", sections: [], extra: [] };
  let section: TimelineSection | null = null;
  let period: TimelinePeriod | null = null;

  const currentSection = (): TimelineSection => {
    if (!section) {
      section = { title: null, periods: [] };
      model.sections.push(section);
    }
    return section;
  };

  for (const raw of lines.slice(header + 1)) {
    const line = raw.trim();
    if (line === "") continue;

    const sectionLine = /^section\s+(.*)$/.exec(line);
    const titleLine = /^title\s+(.*)$/.exec(line);
    if (sectionLine) {
      section = { title: decodeText((sectionLine[1] ?? "").trim()), periods: [] };
      model.sections.push(section);
      period = null;
    } else if (titleLine) {
      model.title = (titleLine[1] ?? "").trim();
    } else if (line.startsWith("%%") || /^acc(Title|Descr)\b/.test(line)) {
      model.extra.push(line);
    } else if (line.startsWith(":") && period) {
      period.events.push(...splitEvents(line.slice(1)));
    } else if (!line.startsWith(":")) {
      const [label = "", ...events] = line.split(":");
      period = { label: decodeText(label.trim()), events: events.flatMap((text) => splitEvents(text)) };
      currentSection().periods.push(period);
    } else {
      model.extra.push(line);
    }
  }
  return model;
}

/** One text is one event. A blank text is no event. */
function splitEvents(text: string): string[] {
  const event = decodeText(text.trim());
  return event === "" ? [] : [event];
}

export function serializeTimeline(model: TimelineModel): string {
  const lines = ["timeline"];
  if (model.title) lines.push(`${INDENT}title ${model.title}`);
  lines.push(...model.extra.map((line) => `${INDENT}${line}`));

  for (const section of model.sections) {
    const named = section.title !== null;
    if (named) lines.push(`${INDENT}section ${encodeText((section.title ?? "").trim()) || EMPTY_LABEL_PLACEHOLDER}`);
    else if (section.periods.length === 0) continue;
    const indent = named ? INDENT.repeat(2) : INDENT;
    for (const period of section.periods) {
      const label = encodeText(period.label.trim()) || EMPTY_LABEL_PLACEHOLDER;
      const events = period.events.map(encodeText).filter((text) => text.trim() !== "");
      lines.push(`${indent}${[label, ...events].join(" : ")}`);
    }
  }

  const text = lines.join("\n") + "\n";
  return model.prefix ? model.prefix.replace(/\s*$/, "\n") + text : text;
}
