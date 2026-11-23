import { useTranslate } from "@/lib/i18n";
import {
  NOTE_PLACEMENTS,
  SEQUENCE_ARROWS,
  addMessage,
  addNote,
  addParticipant,
  canMove,
  knownIds,
  moveEntry,
  removeEntry,
  updateEntry,
  type Message,
  type Note,
  type NotePlacement,
  type Participant,
  type ParticipantKind,
  type SequenceArrow,
  type SequenceModel,
} from "@/lib/sequence";
import { AddButton, CommitField, DeleteButton, MoveButtons, SelectField, Section } from "./fields";
import { FocusRow } from "./focus";

interface Props {
  model: SequenceModel;
  onChange(model: SequenceModel): void;
}

const ARROW_LABELS = {
  "->>": "arrowSolidHead",
  "-->>": "arrowDottedHead",
  "->": "arrowSolidOpen",
  "-->": "arrowDottedOpen",
  "-x": "arrowSolidCross",
  "--x": "arrowDottedCross",
  "-)": "arrowSolidAsync",
  "--)": "arrowDottedAsync",
} as const satisfies Record<SequenceArrow, string>;

const PLACEMENT_LABELS = { over: "placeOver", "right of": "placeRightOf", "left of": "placeLeftOf" } as const satisfies Record<NotePlacement, string>;

export function SequenceInspector({ model, onChange }: Props) {
  const t = useTranslate();
  const ids = knownIds(model);
  const idOptions = ids.map((id) => ({ value: id, label: id }));
  const kindOptions: { value: ParticipantKind; label: string }[] = [
    { value: "participant", label: t.kindParticipant },
    { value: "actor", label: t.kindActor },
  ];
  const arrowOptions = SEQUENCE_ARROWS.map((arrow) => ({ value: arrow, label: `${arrow}  ${t[ARROW_LABELS[arrow]]}` }));
  const placementOptions = NOTE_PLACEMENTS.map((placement) => ({ value: placement, label: t[PLACEMENT_LABELS[placement]] }));

  const controls = (index: number) => (
    <>
      <MoveButtons canMoveUp={canMove(model, index, -1)} canMoveDown={canMove(model, index, 1)} upLabel={t.moveUp} downLabel={t.moveDown} onMove={(step) => onChange(moveEntry(model, index, step))} />
      <DeleteButton label={t.delete} onClick={() => onChange(removeEntry(model, index))} />
    </>
  );

  const participantRow = (entry: Participant, index: number) => (
    <FocusRow key={index} focusKey={String(index)} className="space-y-2 rounded-md border p-2" data-testid="sequence-participant">
      <div className="flex items-center gap-1">
        <SelectField ariaLabel={t.kindParticipant} value={entry.kind} options={kindOptions} onChange={(kind) => onChange(updateEntry(model, index, { kind }))} />
        <span className="text-muted-foreground min-w-0 flex-1 truncate px-1 font-mono text-xs" title={entry.id}>
          {entry.id}
        </span>
        {controls(index)}
      </div>
      <CommitField ariaLabel={t.participantLabel} placeholder={entry.id} value={entry.label} onCommit={(label) => onChange(updateEntry(model, index, { label }))} />
    </FocusRow>
  );

  const messageRow = (entry: Message, index: number) => (
    <FocusRow key={index} focusKey={String(index)} className="space-y-2 rounded-md border p-2" data-testid="sequence-step">
      <div className="flex items-center gap-1">
        <SelectField className="min-w-0 flex-1" ariaLabel={t.linkFrom} value={entry.from} options={idOptions} onChange={(from) => onChange(updateEntry(model, index, { from }))} />
        <SelectField className="min-w-0 flex-1" ariaLabel={t.linkTo} value={entry.to} options={idOptions} onChange={(to) => onChange(updateEntry(model, index, { to }))} />
      </div>
      <SelectField className="w-full" ariaLabel={t.arrowType} value={entry.arrow} options={arrowOptions} onChange={(arrow) => onChange(updateEntry(model, index, { arrow }))} />
      <div className="flex items-center gap-1">
        <CommitField className="flex-1" ariaLabel={t.messageText} value={entry.text} onCommit={(text) => onChange(updateEntry(model, index, { text }))} />
        {controls(index)}
      </div>
    </FocusRow>
  );

  const noteRow = (entry: Note, index: number) => (
    <FocusRow key={index} focusKey={String(index)} className="space-y-2 rounded-md border border-dashed p-2" data-testid="sequence-step">
      <div className="flex items-center gap-1">
        <SelectField className="min-w-0 flex-1" ariaLabel={t.notePlacement} value={entry.placement} options={placementOptions} onChange={(placement) => onChange(updateEntry(model, index, { placement }))} />
        {controls(index)}
      </div>
      <CommitField ariaLabel={t.noteActors} value={entry.actors} onCommit={(actors) => onChange(updateEntry(model, index, { actors }))} />
      <CommitField ariaLabel={t.noteText} value={entry.text} onCommit={(text) => onChange(updateEntry(model, index, { text }))} />
    </FocusRow>
  );

  return (
    <div data-testid="sequence-inspector">
      <Section title={t.participants}>
        <ul className="space-y-2">{model.entries.map((entry, index) => (entry.type === "participant" ? participantRow(entry, index) : null))}</ul>
        <AddButton onClick={() => onChange(addParticipant(model))}>{t.addParticipant}</AddButton>
      </Section>
      <Section title={t.messagesAndNotes}>
        <ul className="space-y-2">
          {model.entries.map((entry, index) => (entry.type === "message" ? messageRow(entry, index) : entry.type === "note" ? noteRow(entry, index) : null))}
        </ul>
        <AddButton onClick={() => onChange(addMessage(model, t.newMessageText))}>{t.addMessage}</AddButton>
        <AddButton onClick={() => onChange(addNote(model, t.newNoteText))}>{t.addNote}</AddButton>
      </Section>
    </div>
  );
}
