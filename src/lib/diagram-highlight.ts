import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { detectDiagramKind, findHeaderLine, type DiagramKind } from "@/lib/diagram-type";

/**
 * `codemirror-lang-mermaid` has no grammar for timeline, quadrant, class, state, ER and git diagrams,
 * so this module marks their tokens itself. The roles match the colour roles of the editor theme (`editor-theme.ts`).
 */
export type HighlightRole = "comment" | "keyword" | "number" | "operator" | "string" | "identifier";

export interface HighlightToken {
  from: number;
  to: number;
  role: HighlightRole;
}

export const HIGHLIGHT_ROLES: HighlightRole[] = ["comment", "keyword", "number", "operator", "string", "identifier"];
export const highlightClass = (role: HighlightRole) => `cm-mmd-${role}`;

/** One scanning rule. `pattern` must be sticky (`y`). A rule with `role: null` skips the text. */
interface Rule {
  pattern: RegExp;
  role: HighlightRole | null;
  /** Only when no token was found before on this line. */
  atStart?: boolean;
  /** Only when the previous token on this line has one of these roles. */
  after?: HighlightRole[];
  /** After the match, the rest of the line is one token of this role. */
  restRole?: HighlightRole;
}

/** Tokens of one non-blank, non-comment line after the header. `indent` is the offset of the first visible character. */
type LineTokenizer = (text: string, indent: number) => HighlightToken[];

const FALLBACK = /[\w-]+|\S/y;

/** Walks along `text` and applies the first matching rule at each position. Offsets are relative to `text`. */
function scan(text: string, from: number, rules: Rule[], tokens: HighlightToken[] = []): HighlightToken[] {
  let cursor = from;
  while (cursor < text.length) {
    if (/\s/.test(text[cursor] ?? "")) {
      cursor++;
      continue;
    }
    const previous = tokens.at(-1);
    let advanced = false;
    for (const rule of rules) {
      if (rule.atStart && tokens.length > 0) continue;
      if (rule.after && !(previous && rule.after.includes(previous.role))) continue;
      rule.pattern.lastIndex = cursor;
      const match = rule.pattern.exec(text);
      if (!match || match[0].length === 0) continue;
      const end = cursor + match[0].length;
      if (rule.role) tokens.push({ from: cursor, to: end, role: rule.role });
      cursor = end;
      if (rule.restRole) {
        const rest = text.slice(cursor);
        const start = cursor + rest.length - rest.trimStart().length;
        const stop = text.trimEnd().length;
        if (stop > start) tokens.push({ from: start, to: stop, role: rule.restRole });
        return tokens;
      }
      advanced = true;
      break;
    }
    if (!advanced) {
      FALLBACK.lastIndex = cursor;
      cursor += FALLBACK.exec(text)?.[0].length ?? 1;
    }
  }
  return tokens;
}

const STRING: Rule = { pattern: /"[^"]*"/y, role: "string" };
const ANNOTATION: Rule = { pattern: /<<[^>]*>>/y, role: "keyword" };
const NUMBER: Rule = { pattern: /\d+(?:\.\d+)?(?![\w])/y, role: "number" };
const BRACES: Rule = { pattern: /[{}()[\]]/y, role: "operator" };
/** `: text` ends the line with a label. */
const LABEL: Rule = { pattern: /:/y, role: "operator", restRole: "string" };
const NAME_AFTER_KEYWORD: Rule = { pattern: /[\w./-]+/y, role: "identifier", after: ["keyword"] };
const NAME_AFTER_OPERATOR: Rule = { pattern: /[A-Za-z_][\w-]*/y, role: "identifier", after: ["operator", "string"] };
const NAME_AT_START: Rule = { pattern: /[A-Za-z_][\w-]*/y, role: "identifier", atStart: true };

/** A keyword that opens a line. */
function lineKeyword(words: string): Rule {
  return { pattern: new RegExp(`(?:${words})(?![\\w-])`, "y"), role: "keyword", atStart: true };
}

/** A keyword that opens a line and is followed by free text (`title Name`, `section Name`). */
function lineKeywordWithText(words: string): Rule {
  return { ...lineKeyword(words), restRole: "string" };
}

const TIMELINE_KEYWORD = /^(title|section|accTitle|accDescr)(?=\s|:|\{|$)/;

/** Trims blanks from both ends of every token that is not an operator. */
function trimTokens(text: string, tokens: HighlightToken[]): HighlightToken[] {
  return tokens.flatMap((token) => {
    if (token.role === "operator") return [token];
    const slice = text.slice(token.from, token.to);
    const from = token.from + (slice.length - slice.trimStart().length);
    const to = token.from + slice.trimEnd().length;
    return to > from ? [{ ...token, from, to }] : [];
  });
}

/** `title Name`, `section Name`, `accTitle: Name`, a period line (`2004 : A : B`) or a continuation line (`: B`). */
const tokenizeTimelineLine: LineTokenizer = (text, indent) => {
  const keyword = TIMELINE_KEYWORD.exec(text.slice(indent));
  const keywordEnd = indent + (keyword?.[0].length ?? 0);
  const tokens: HighlightToken[] = keyword ? [{ from: indent, to: keywordEnd, role: "keyword" }] : [];
  // `title Name` and `section Name` take the rest of the line. `accTitle: Name` has a colon first.
  if (keyword && text[keywordEnd] !== ":") {
    return trimTokens(text, [...tokens, { from: keywordEnd, to: text.length, role: "string" }]);
  }
  let cursor = keywordEnd;
  let isFirstPart = !keyword;
  while (cursor <= text.length) {
    const colon = text.indexOf(":", cursor);
    const partEnd = colon === -1 ? text.length : colon;
    tokens.push({ from: cursor, to: partEnd, role: isFirstPart ? "number" : "string" });
    if (colon === -1) break;
    tokens.push({ from: colon, to: colon + 1, role: "operator" });
    cursor = colon + 1;
    isFirstPart = false;
  }
  return trimTokens(text, tokens);
};

const QUADRANT_AXIS_RULES: Rule[] = [
  lineKeyword("x-axis|y-axis"),
  { pattern: /-->/y, role: "operator", after: ["string"] },
  { pattern: /(?:(?!-->).)+?(?=\s*-->|\s*$)/y, role: "string", after: ["keyword", "operator"] },
];

const QUADRANT_RULES: Rule[] = [
  lineKeywordWithText("title|quadrant-[1-4]"),
  lineKeyword("classDef"),
  NAME_AFTER_KEYWORD,
  // A point: `Name:::class: [0.3, 0.6] radius: 12, color: #ff3300`
  { pattern: /[^:[\]]+?(?=\s*(?::::?\w+)?\s*:\s*\[)/y, role: "string", atStart: true },
  { pattern: /:::\w+/y, role: "identifier" },
  { pattern: /[\w-]+(?=\s*:(?!:))/y, role: "identifier", after: ["operator", "number"] },
  { pattern: /[:[\],]/y, role: "operator" },
  { pattern: /#[0-9a-fA-F]{3,8}\b/y, role: "number" },
  NUMBER,
];

const QUADRANT_AXIS_LINE = /^(?:x-axis|y-axis)(?![\w-])/;

const CLASS_ARROW = String.raw`(?:<\|--|--\|>|<\|\.\.|\.\.\|>|\*--|--\*|o--|--o|<-->|<--|-->|\.\.>|<\.\.|--|\.\.)`;
const CLASS_RULES: Rule[] = [
  STRING,
  ANNOTATION,
  lineKeyword("classDiagram|classDef|class|namespace|direction|note|link|click|callback|style|cssClass"),
  { pattern: /for(?![\w-])/y, role: "keyword", after: ["keyword"] },
  { pattern: new RegExp(CLASS_ARROW, "y"), role: "operator" },
  LABEL,
  BRACES,
  { pattern: /[+#~-](?=\w)/y, role: "operator", atStart: true },
  NUMBER,
  NAME_AFTER_KEYWORD,
  NAME_AFTER_OPERATOR,
  NAME_AT_START,
];

const STATE_RULES: Rule[] = [
  STRING,
  ANNOTATION,
  lineKeyword("state|note|direction|class|classDef|style|click|scale|hide|accTitle|accDescr"),
  { pattern: /(?:as|of)(?![\w-])/y, role: "keyword", after: ["identifier", "string", "keyword"] },
  { pattern: /(?:left|right)(?![\w-])/y, role: "keyword", after: ["keyword"] },
  { pattern: /\[\*\]/y, role: "operator" },
  { pattern: /-->|--/y, role: "operator" },
  LABEL,
  BRACES,
  NAME_AFTER_KEYWORD,
  NAME_AFTER_OPERATOR,
  NAME_AT_START,
];

const ER_END = String.raw`(?:\|\||\|o|o\||\}o|o\{|\}\||\|\{)`;
const ER_RULES: Rule[] = [
  STRING,
  { pattern: new RegExp(`${ER_END}(?:--|\\.\\.)${ER_END}`, "y"), role: "operator" },
  { pattern: /(?:PK|FK|UK)(?![\w-])/y, role: "keyword" },
  LABEL,
  BRACES,
  NAME_AFTER_OPERATOR,
  NAME_AT_START,
];

const GIT_RULES: Rule[] = [
  STRING,
  lineKeyword("commit|branch|checkout|switch|merge|cherry-pick|reset"),
  { pattern: /(?:id|tag|type|parent|order)(?=\s*:)/y, role: "identifier" },
  { pattern: /(?:NORMAL|REVERSE|HIGHLIGHT)(?![\w-])/y, role: "keyword" },
  { pattern: /:/y, role: "operator" },
  NUMBER,
  NAME_AFTER_KEYWORD,
];

const TOKENIZERS: Partial<Record<DiagramKind, LineTokenizer>> = {
  timeline: tokenizeTimelineLine,
  quadrant: (text, indent) => trimTokens(text, scan(text, indent, QUADRANT_AXIS_LINE.test(text.slice(indent)) ? QUADRANT_AXIS_RULES : QUADRANT_RULES)),
  class: (text, indent) => scan(text, indent, CLASS_RULES),
  state: (text, indent) => scan(text, indent, STATE_RULES),
  er: (text, indent) => scan(text, indent, ER_RULES),
  git: (text, indent) => scan(text, indent, GIT_RULES),
};

/** Tokens of one line, with offsets relative to the line start. */
function tokenizeLine(tokenizer: LineTokenizer, line: string, isHeader: boolean): HighlightToken[] {
  const indent = line.length - line.trimStart().length;
  const text = line.trimEnd();
  if (text.length <= indent) return [];
  if (text.startsWith("%%", indent)) return [{ from: indent, to: text.length, role: "comment" }];
  if (isHeader) {
    const word = /^[\w-]+/.exec(text.slice(indent))?.[0] ?? "";
    return word ? [{ from: indent, to: indent + word.length, role: "keyword" }] : [];
  }
  return tokenizer(text, indent);
}

/** Tokens of a whole document, with absolute offsets. Empty unless the diagram type is one this module handles. */
export function tokenizeDiagram(code: string): HighlightToken[] {
  const tokenizer = TOKENIZERS[detectDiagramKind(code)];
  if (!tokenizer) return [];
  const lines = code.split("\n");
  const header = findHeaderLine(lines.map((line) => line.replace(/\r$/, "")));
  const tokens: HighlightToken[] = [];
  let offset = 0;
  lines.forEach((line, index) => {
    // Front matter (before the header) is left alone, except comments.
    if (index >= header || line.trimStart().startsWith("%%")) {
      for (const token of tokenizeLine(tokenizer, line, index === header)) {
        tokens.push({ from: offset + token.from, to: offset + token.to, role: token.role });
      }
    }
    offset += line.length + 1;
  });
  return tokens;
}

function buildDecorations(code: string): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  let last = 0;
  for (const token of tokenizeDiagram(code)) {
    // Ranges must be sorted and must not overlap.
    if (token.from < last || token.to <= token.from) continue;
    builder.add(token.from, token.to, Decoration.mark({ class: highlightClass(token.role) }));
    last = token.to;
  }
  return builder.finish();
}

export const diagramHighlight: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view.state.doc.toString());
    }
    update(update: ViewUpdate) {
      if (update.docChanged) this.decorations = buildDecorations(update.state.doc.toString());
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
