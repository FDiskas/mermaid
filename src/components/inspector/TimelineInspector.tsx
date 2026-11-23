import { useTranslate } from "@/lib/i18n";
import type { TimelineModel, TimelinePeriod } from "@/lib/timeline";
import { AddButton, CommitField, DeleteButton, Field, Section } from "./fields";
import { SectionList } from "./SectionList";

interface Props {
  model: TimelineModel;
  onChange(model: TimelineModel): void;
}

export function TimelineInspector({ model, onChange }: Props) {
  const t = useTranslate();
  const newPeriod = (): TimelinePeriod => ({ label: t.periodLabel, events: [t.eventLabel] });

  return (
    <div data-testid="timeline-inspector">
      <Section>
        <Field label={t.timelineTitle} htmlFor="timeline-title">
          <CommitField id="timeline-title" value={model.title} onCommit={(title) => onChange({ ...model, title })} />
        </Field>
      </Section>

      <SectionList
        sections={model.sections}
        onChange={(sections) => onChange({ ...model, sections })}
        createSection={(title) => ({ title, periods: [newPeriod()] })}
        addFirstItemLabel={t.addPeriod}
        renderBody={(section, replace) => {
          const patchPeriod = (index: number, patch: (period: TimelinePeriod) => TimelinePeriod) =>
            replace({ ...section, periods: section.periods.map((period, i) => (i === index ? patch(period) : period)) });
          return (
            <>
              <ul className="space-y-3">
                {section.periods.map((period, periodIndex) => (
                  <li key={periodIndex} className="space-y-1.5 rounded-md border p-2" data-testid="timeline-period">
                    <div className="flex items-center gap-2">
                      <CommitField className="flex-1" value={period.label} ariaLabel={t.periodLabel} onCommit={(label) => patchPeriod(periodIndex, (p) => ({ ...p, label }))} />
                      <DeleteButton label={t.delete} onClick={() => replace({ ...section, periods: section.periods.filter((_, i) => i !== periodIndex) })} />
                    </div>
                    {period.events.map((event, eventIndex) => (
                      <div key={eventIndex} className="flex items-center gap-2 pl-4">
                        <CommitField
                          className="flex-1"
                          value={event}
                          ariaLabel={t.eventLabel}
                          onCommit={(text) => patchPeriod(periodIndex, (p) => ({ ...p, events: p.events.map((e, i) => (i === eventIndex ? text : e)) }))}
                        />
                        <DeleteButton label={t.delete} onClick={() => patchPeriod(periodIndex, (p) => ({ ...p, events: p.events.filter((_, i) => i !== eventIndex) }))} />
                      </div>
                    ))}
                    <div className="pl-4">
                      <AddButton onClick={() => patchPeriod(periodIndex, (p) => ({ ...p, events: [...p.events, t.eventLabel] }))}>{t.addEvent}</AddButton>
                    </div>
                  </li>
                ))}
              </ul>
              <AddButton onClick={() => replace({ ...section, periods: [...section.periods, newPeriod()] })}>{t.addPeriod}</AddButton>
            </>
          );
        }}
      />
    </div>
  );
}
