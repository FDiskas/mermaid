import { Button } from "@/components/ui/button";
import { useTranslate } from "@/lib/i18n";
import { GANTT_TAGS, type GanttModel, type GanttTag, type GanttTask } from "@/lib/gantt";
import { AddButton, CommitField, DeleteButton, Field, Section } from "./fields";
import { SectionList } from "./SectionList";

interface Props {
  model: GanttModel;
  onChange(model: GanttModel): void;
}

const DEFAULT_DURATION = "3d";

export function GanttInspector({ model, onChange }: Props) {
  const t = useTranslate();
  const newTask = (): GanttTask => ({ name: t.taskName, tags: [], id: "", start: "", end: DEFAULT_DURATION });
  const tagLabels: Record<GanttTag, string> = { crit: t.tagCrit, done: t.tagDone, active: t.tagActive, milestone: t.tagMilestone };

  return (
    <div data-testid="gantt-inspector">
      <Section>
        <Field label={t.diagramTitle} htmlFor="gantt-title">
          <CommitField id="gantt-title" value={model.title} onCommit={(title) => onChange({ ...model, title })} />
        </Field>
        <Field label={t.dateFormat} htmlFor="gantt-date-format">
          <CommitField id="gantt-date-format" value={model.dateFormat} onCommit={(dateFormat) => onChange({ ...model, dateFormat })} />
        </Field>
        <Field label={t.axisFormat} htmlFor="gantt-axis-format">
          <CommitField id="gantt-axis-format" value={model.axisFormat} onCommit={(axisFormat) => onChange({ ...model, axisFormat })} />
        </Field>
      </Section>

      <SectionList
        sections={model.sections}
        onChange={(sections) => onChange({ ...model, sections })}
        createSection={(title) => ({ title, tasks: [newTask()] })}
        addFirstItemLabel={t.addTask}
        renderBody={(section, replace) => {
          const patchTask = (index: number, patch: Partial<GanttTask>) =>
            replace({ ...section, tasks: section.tasks.map((task, i) => (i === index ? { ...task, ...patch } : task)) });
          const toggleTag = (index: number, tag: GanttTag) => {
            const tags = section.tasks[index]?.tags ?? [];
            // Keep the canonical order, so the code does not change when flags are toggled in another order.
            patchTask(index, { tags: GANTT_TAGS.filter((candidate) => (candidate === tag ? !tags.includes(tag) : tags.includes(candidate))) });
          };
          return (
            <>
              <ul className="space-y-3">
                {section.tasks.map((task, index) => (
                  <li key={index} className="space-y-2 rounded-md border p-2" data-testid="gantt-task">
                    <div className="flex items-center gap-2">
                      <CommitField className="flex-1" ariaLabel={t.taskName} value={task.name} onCommit={(name) => patchTask(index, { name })} />
                      <DeleteButton label={t.delete} onClick={() => replace({ ...section, tasks: section.tasks.filter((_, i) => i !== index) })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label={t.ganttStart}>
                        <CommitField ariaLabel={t.ganttStart} value={task.start} onCommit={(start) => patchTask(index, { start })} />
                      </Field>
                      <Field label={t.ganttEnd}>
                        <CommitField ariaLabel={t.ganttEnd} value={task.end} onCommit={(end) => patchTask(index, { end })} />
                      </Field>
                    </div>
                    <Field label={t.taskId}>
                      <CommitField ariaLabel={t.taskId} value={task.id} onCommit={(id) => patchTask(index, { id })} />
                    </Field>
                    <div className="flex flex-wrap gap-1.5" role="group">
                      {GANTT_TAGS.map((tag) => (
                        <Button key={tag} variant={task.tags.includes(tag) ? "secondary" : "outline"} size="sm" aria-pressed={task.tags.includes(tag)} onClick={() => toggleTag(index, tag)}>
                          {tagLabels[tag]}
                        </Button>
                      ))}
                    </div>
                  </li>
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
