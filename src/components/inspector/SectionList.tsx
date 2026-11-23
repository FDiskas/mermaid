import type { ReactNode } from "react";
import { useTranslate } from "@/lib/i18n";
import { AddButton, CommitField, DeleteButton, Section } from "./fields";

interface SectionLike {
  /** `null` for items written before the first `section` line. */
  title: string | null;
}

interface Props<Item extends SectionLike> {
  sections: Item[];
  onChange(sections: Item[]): void;
  /** A new section holding one new item. `title` is `null` for the untitled first section. */
  createSection(title: string | null): Item;
  /** Label of the button that adds the first item when there are no sections yet. */
  addFirstItemLabel: string;
  /** The items of one section. `replace` stores the changed section. */
  renderBody(section: Item, replace: (next: Item) => void): ReactNode;
}

/** The list of sections shared by the timeline, journey and Gantt panels. */
export function SectionList<Item extends SectionLike>({ sections, onChange, createSection, addFirstItemLabel, renderBody }: Props<Item>) {
  const t = useTranslate();
  const replaceAt = (index: number, next: Item) => onChange(sections.map((section, i) => (i === index ? next : section)));

  return (
    <>
      {sections.map((section, index) => (
        <Section key={index}>
          <div data-testid="section" className="space-y-3">
            {section.title !== null && (
              <div className="flex items-center gap-2">
                <CommitField className="flex-1 font-medium" value={section.title} ariaLabel={t.sectionTitle} onCommit={(title) => replaceAt(index, { ...section, title })} />
                <DeleteButton label={t.delete} onClick={() => onChange(sections.filter((_, i) => i !== index))} />
              </div>
            )}
            {renderBody(section, (next) => replaceAt(index, next))}
          </div>
        </Section>
      ))}
      <Section>
        {sections.length === 0 && <AddButton onClick={() => onChange([createSection(null)])}>{addFirstItemLabel}</AddButton>}
        <AddButton onClick={() => onChange([...sections, createSection(t.sectionTitle)])}>{t.addSection}</AddButton>
      </Section>
    </>
  );
}
