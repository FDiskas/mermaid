import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { Tag } from "@lezer/highlight";
import {
  flowchartTags,
  ganttTags,
  journeyTags,
  mermaidTags,
  mindmapTags,
  pieTags,
  requirementTags,
  sequenceTags,
} from "codemirror-lang-mermaid";

type Role = "comment" | "keyword" | "number" | "operator" | "identifier" | "string";

const PALETTE: Record<"dark" | "light", Record<Role, string>> = {
  dark: {
    comment: "#6b7a99",
    keyword: "#c4a5ff",
    number: "#fdba74",
    operator: "#67e8f9",
    identifier: "#93c5fd",
    string: "#fcd34d",
  },
  light: {
    comment: "#7a869f",
    keyword: "#7c3aed",
    number: "#c2410c",
    operator: "#0e7490",
    identifier: "#1d4ed8",
    string: "#a16207",
  },
};

function roleOf(tagName: string): Role | null {
  if (/comment/i.test(tagName)) return "comment";
  if (/^(diagramName|keyword\d?|orientation|title|showData|position)$/.test(tagName)) return "keyword";
  if (/^(number|score)$/.test(tagName)) return "number";
  if (/^(arrow|link|nodeEdge)$/.test(tagName)) return "operator";
  if (/^(nodeId|actor)$/.test(tagName)) return "identifier";
  if (/string|text/i.test(tagName)) return "string";
  return null;
}

const ALL_TAGS: Record<string, Tag>[] = [
  mermaidTags,
  mindmapTags,
  pieTags,
  flowchartTags,
  sequenceTags,
  journeyTags,
  requirementTags,
  ganttTags,
];

function highlightStyle(mode: "dark" | "light"): HighlightStyle {
  const colors = PALETTE[mode];
  const specs = ALL_TAGS.flatMap((tags) =>
    Object.entries(tags).flatMap(([name, tag]) => {
      const role = roleOf(name);
      if (!role) return [];
      return [{ tag, color: colors[role], fontStyle: role === "comment" ? "italic" : undefined }];
    }),
  );
  return HighlightStyle.define(specs);
}

const baseTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent", fontSize: "13px", color: "var(--foreground)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace', lineHeight: "1.7" },
  ".cm-content": { caretColor: "var(--foreground)", padding: "8px 0" },
  ".cm-gutters": { backgroundColor: "transparent", color: "var(--muted-foreground)", border: "none" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--foreground)" },
  ".cm-cursor": { borderLeftColor: "var(--foreground)" },
  ".cm-tooltip": { backgroundColor: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)" },
  ".cm-panels": { backgroundColor: "var(--panel)", color: "var(--foreground)" },
});

export function editorTheme(dark: boolean): Extension {
  const mode = dark ? "dark" : "light";
  return [
    baseTheme,
    EditorView.theme(
      {
        ".cm-activeLine": { backgroundColor: dark ? "rgb(148 163 184 / 0.08)" : "rgb(100 116 139 / 0.08)" },
        "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground": {
          backgroundColor: dark ? "rgb(99 102 241 / 0.35)" : "rgb(99 102 241 / 0.22)",
        },
      },
      { dark },
    ),
    syntaxHighlighting(highlightStyle(mode)),
  ];
}
