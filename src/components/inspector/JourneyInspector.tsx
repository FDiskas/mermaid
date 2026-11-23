import { Button } from "@/components/ui/button";
import { useTranslate } from "@/lib/i18n";
import { journeySectionKey, journeyTaskKey } from "@/lib/focus/journey";
import { MAX_SCORE, MIN_SCORE, type JourneyModel, type JourneyTask } from "@/lib/journey";
import { AddButton, CommitField, DeleteButton, Field, Section } from "./fields";
import { FocusRow } from "./focus";
import { SectionList } from "./SectionList";

interface Props {
  model: JourneyModel;
  onChange(model: JourneyModel): void;
}

const SCORES = Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, i) => MIN_SCORE + i);
const DEFAULT_SCORE = 3;

export function JourneyInspector({ model, onChange }: Props) {
  const t = useTranslate();
  const newTask = (): JourneyTask => ({ name: t.taskName, score: DEFAULT_SCORE, actors: [] });

  return (
    <div data-testid="journey-inspector">
      <Section>
        <Field label={t.diagramTitle} htmlFor="journey-title">
          <CommitField id="journey-title" value={model.title} onCommit={(title) => onChange({ ...model, title })} />
        </Field>
      </Section>

      <SectionList
        sections={model.sections}
        onChange={(sections) => onChange({ ...model, sections })}
        createSection={(title) => ({ title, tasks: [newTask()] })}
        addFirstItemLabel={t.addTask}
        titleFocusKey={journeySectionKey}
        renderBody={(section, replace) => {
          // Tasks are keyed by their place among all tasks of the diagram, not by their place in the section.
          const firstTask = model.sections.slice(0, model.sections.indexOf(section)).reduce((count, earlier) => count + earlier.tasks.length, 0);
          const patchTask = (index: number, patch: Partial<JourneyTask>) =>
            replace({ ...section, tasks: section.tasks.map((task, i) => (i === index ? { ...task, ...patch } : task)) });
          return (
            <>
              <ul className="space-y-3">
                {section.tasks.map((task, index) => (
                  <FocusRow key={index} focusKey={journeyTaskKey(firstTask + index)} className="space-y-2 rounded-md border p-2" data-testid="journey-task">
                    <div className="flex items-center gap-2">
                      <CommitField className="flex-1" ariaLabel={t.taskName} value={task.name} onCommit={(name) => patchTask(index, { name })} />
                      <DeleteButton label={t.delete} onClick={() => replace({ ...section, tasks: section.tasks.filter((_, i) => i !== index) })} />
                    </div>
                    <div className="flex items-center gap-1" role="group" aria-label={t.taskScore}>
                      {SCORES.map((score) => (
                        <Button
                          key={score}
                          variant={task.score === score ? "secondary" : "outline"}
                          size="icon-sm"
                          aria-label={`${t.taskScore} ${score}`}
                          aria-pressed={task.score === score}
                          onClick={() => patchTask(index, { score })}
                        >
                          {score}
                        </Button>
                      ))}
                    </div>
                    <CommitField
                      ariaLabel={t.taskActors}
                      value={task.actors.join(", ")}
                      onCommit={(text) => patchTask(index, { actors: text.split(",").map((actor) => actor.trim()).filter(Boolean) })}
                    />
                  </FocusRow>
                ))}
              </ul>
              <AddButton onClick={() => replace({ ...section, tasks: [...section.tasks, newTask()] })}>{t.addTask}</AddButton>
            </>
          );
        }}
      />
    </div>
  );
}
