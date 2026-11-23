import { useTranslate } from "@/lib/i18n";
import {
  TERMINAL_STATE,
  addState,
  addTransition,
  canMoveTransition,
  moveTransition,
  removeEntry,
  removeState,
  setStateText,
  stateIds,
  stateText,
  updateTransition,
  type StateModel,
} from "@/lib/state";
import { AddButton, CommitField, DeleteButton, MoveButtons, SelectField, Section } from "./fields";

interface Props {
  model: StateModel;
  onChange(model: StateModel): void;
}

export function StateInspector({ model, onChange }: Props) {
  const t = useTranslate();
  const ids = stateIds(model);
  const endpointOptions = [{ value: TERMINAL_STATE, label: `${TERMINAL_STATE} ${t.startEndState}` }, ...ids.map((id) => ({ value: id, label: id }))];

  return (
    <div data-testid="state-inspector">
      <Section title={t.states}>
        <ul className="space-y-2">
          {ids.map((id) => (
            <li key={id} className="space-y-2 rounded-md border p-2" data-testid="state-item">
              <div className="flex items-center gap-1">
                <span className="min-w-0 flex-1 truncate px-1 font-mono text-xs" title={id}>
                  {id}
                </span>
                <DeleteButton label={t.delete} onClick={() => onChange(removeState(model, id))} />
              </div>
              <CommitField ariaLabel={t.stateDescription} value={stateText(model, id)} onCommit={(text) => onChange(setStateText(model, id, text))} />
            </li>
          ))}
        </ul>
        <AddButton onClick={() => onChange(addState(model, t.newStateText))}>{t.addState}</AddButton>
      </Section>
      <Section title={t.transitions}>
        <ul className="space-y-2">
          {model.entries.map((entry, index) =>
            entry.type === "transition" ? (
              <li key={index} className="space-y-2 rounded-md border p-2" data-testid="state-transition">
                <div className="flex items-center gap-1">
                  <SelectField className="min-w-0 flex-1" ariaLabel={t.linkFrom} value={entry.from} options={endpointOptions} onChange={(from) => onChange(updateTransition(model, index, { from }))} />
                  <SelectField className="min-w-0 flex-1" ariaLabel={t.linkTo} value={entry.to} options={endpointOptions} onChange={(to) => onChange(updateTransition(model, index, { to }))} />
                </div>
                <div className="flex items-center gap-1">
                  <CommitField className="flex-1" ariaLabel={t.linkLabel} value={entry.label} onCommit={(label) => onChange(updateTransition(model, index, { label }))} />
                  <MoveButtons
                    canMoveUp={canMoveTransition(model, index, -1)}
                    canMoveDown={canMoveTransition(model, index, 1)}
                    upLabel={t.moveUp}
                    downLabel={t.moveDown}
                    onMove={(step) => onChange(moveTransition(model, index, step))}
                  />
                  <DeleteButton label={t.delete} onClick={() => onChange(removeEntry(model, index))} />
                </div>
              </li>
            ) : null,
          )}
        </ul>
        <AddButton onClick={() => onChange(addTransition(model))}>{t.addTransition}</AddButton>
      </Section>
    </div>
  );
}
