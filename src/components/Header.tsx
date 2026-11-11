import { Info, LayoutGrid, Moon, Sun, Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DiagramKind } from "@/lib/diagram-type";
import { LANGUAGES, languageLabel, useLanguage, useTranslate } from "@/lib/i18n";
import { TEMPLATES, type Template } from "@/lib/templates";
import type { LanguageCode, translate } from "@/lib/translate";

const KIND_LABEL: Record<DiagramKind, keyof typeof translate> = {
  flowchart: "typeFlowchart",
  sequence: "typeSequence",
  class: "typeClass",
  state: "typeState",
  er: "typeEr",
  gantt: "typeGantt",
  pie: "typePie",
  journey: "typeJourney",
  git: "typeGit",
  mindmap: "typeMindmap",
  timeline: "typeTimeline",
  quadrant: "typeQuadrant",
  other: "typeOther",
  empty: "typeOther",
};

interface Props {
  kind: DiagramKind;
  dark: boolean;
  onToggleTheme(): void;
  onTemplate(template: Template): void;
  onClear(): void;
  onAbout(): void;
}

export function Header({ kind, dark, onToggleTheme, onTemplate, onClear, onAbout }: Props) {
  const t = useTranslate();
  const { language, setLanguage } = useLanguage();
  return (
    <header className="bg-card flex h-12 shrink-0 items-center gap-3 border-b px-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-lg">
          <Workflow className="size-4" />
        </span>
        <h1 className="truncate text-sm">
          <span className="font-semibold">{t.appName}</span>
          <span className="text-muted-foreground hidden sm:inline"> · {t.appTagline}</span>
        </h1>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="ml-1" data-testid="template-trigger">
            <LayoutGrid /> {t[KIND_LABEL[kind]] as string}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[70vh] w-60 overflow-y-auto">
          <DropdownMenuLabel>{t.templates}</DropdownMenuLabel>
          {TEMPLATES.map((template) => (
            <DropdownMenuItem key={template.kind} data-testid={`template-${template.kind}`} onSelect={() => onTemplate(template)}>
              {t[template.label] as string}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onAbout} data-testid="about-trigger">
          <Info /> <span className="hidden md:inline">{t.about}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} data-testid="clear">
          <Trash2 /> <span className="hidden md:inline">{t.clear}</span>
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onToggleTheme} aria-label={t.toggleTheme} title={t.toggleTheme} data-testid="theme-toggle">
          {dark ? <Sun /> : <Moon />}
        </Button>
        <Select value={language} onValueChange={(value) => setLanguage(value as LanguageCode)}>
          <SelectTrigger size="sm" aria-label={t.language} className="w-auto gap-1.5 border-0 bg-transparent px-2 shadow-none" data-testid="language-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {LANGUAGES.map((code) => (
              <SelectItem key={code} value={code}>
                {languageLabel(code)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </header>
  );
}
