import { useTranslate } from "@/lib/i18n";
import {
  RELATION_ARROWS,
  addClass,
  addRelation,
  canMove,
  canRename,
  classNames,
  moveEntry,
  removeEntry,
  renameClass,
  updateClass,
  updateRelation,
  type ClassBlock,
  type ClassModel,
  type Relation,
  type RelationArrow,
} from "@/lib/class-diagram";
import { AddButton, CommitField, DeleteButton, MoveButtons, SelectField, Section } from "./fields";

interface Props {
  model: ClassModel;
  onChange(model: ClassModel): void;
}

const ARROW_LABELS = {
  "<|--": "relInheritance",
  "--|>": "relInheritance",
  "*--": "relComposition",
  "--*": "relComposition",
  "o--": "relAggregation",
  "--o": "relAggregation",
  "<--": "relAssociation",
  "-->": "relAssociation",
  "<..": "relDependency",
  "..>": "relDependency",
  "<|..": "relRealization",
  "..|>": "relRealization",
  "--": "relLink",
  "..": "relDashedLink",
} as const satisfies Record<RelationArrow, string>;

const NEW_CLASS_NAME = "NewClass";

export function ClassInspector({ model, onChange }: Props) {
  const t = useTranslate();
  const nameOptions = classNames(model).map((name) => ({ value: name, label: name }));
  const arrowOptions = RELATION_ARROWS.map((arrow) => ({ value: arrow, label: `${arrow}  ${t[ARROW_LABELS[arrow]]}` }));

  const controls = (index: number) => (
    <>
      <MoveButtons canMoveUp={canMove(model, index, -1)} canMoveDown={canMove(model, index, 1)} upLabel={t.moveUp} downLabel={t.moveDown} onMove={(step) => onChange(moveEntry(model, index, step))} />
      <DeleteButton label={t.delete} onClick={() => onChange(removeEntry(model, index))} />
    </>
  );

  const classCard = (entry: ClassBlock, index: number) => {
    const setMembers = (members: string[]) => onChange(updateClass(model, index, { members }));
    return (
      <li key={index} className="space-y-2 rounded-md border p-2" data-testid="class-item">
        <div className="flex items-center gap-1">
          {canRename(model, index) ? (
            <CommitField className="flex-1 font-medium" ariaLabel={t.className} value={entry.name} onCommit={(name) => onChange(renameClass(model, index, name))} />
          ) : (
            <span className="min-w-0 flex-1 truncate px-1 text-sm font-medium" title={t.nameInUse} aria-label={t.className}>
              {entry.name}
            </span>
          )}
          {controls(index)}
        </div>
        {entry.members.map((member, memberIndex) => (
          <div key={memberIndex} className="flex items-center gap-1" data-testid="class-member">
            <CommitField className="flex-1 font-mono text-xs" ariaLabel={t.memberText} value={member} onCommit={(text) => setMembers(entry.members.map((m, i) => (i === memberIndex ? text : m)))} />
            <DeleteButton label={t.delete} onClick={() => setMembers(entry.members.filter((_, i) => i !== memberIndex))} />
          </div>
        ))}
        <AddButton onClick={() => setMembers([...entry.members, "+member"])}>{t.addMember}</AddButton>
      </li>
    );
  };

  const relationCard = (entry: Relation, index: number) => {
    const patch = (change: Partial<Relation>) => onChange(updateRelation(model, index, change));
    return (
      <li key={index} className="space-y-2 rounded-md border p-2" data-testid="class-relation">
        <div className="flex items-center gap-1">
          <SelectField className="min-w-0 flex-1" ariaLabel={t.linkFrom} value={entry.from} options={nameOptions} onChange={(from) => patch({ from })} />
          <SelectField className="min-w-0 flex-1" ariaLabel={t.linkTo} value={entry.to} options={nameOptions} onChange={(to) => patch({ to })} />
        </div>
        <div className="flex items-center gap-1">
          <SelectField className="min-w-0 flex-1" ariaLabel={t.arrowType} value={entry.arrow} options={arrowOptions} onChange={(arrow) => patch({ arrow })} />
          {controls(index)}
        </div>
        <div className="flex items-center gap-1">
          <CommitField className="w-14" ariaLabel={t.cardinalityFrom} placeholder="1" value={entry.fromCardinality} onCommit={(fromCardinality) => patch({ fromCardinality })} />
          <CommitField className="min-w-0 flex-1" ariaLabel={t.linkLabel} placeholder={t.linkLabel} value={entry.label} onCommit={(label) => patch({ label })} />
          <CommitField className="w-14" ariaLabel={t.cardinalityTo} placeholder="*" value={entry.toCardinality} onCommit={(toCardinality) => patch({ toCardinality })} />
        </div>
      </li>
    );
  };

  return (
    <div data-testid="class-inspector">
      <Section title={t.classes}>
        <ul className="space-y-2">{model.entries.map((entry, index) => (entry.type === "class" ? classCard(entry, index) : null))}</ul>
        <AddButton onClick={() => onChange(addClass(model, NEW_CLASS_NAME))}>{t.addClass}</AddButton>
      </Section>
      <Section title={t.relations}>
        <ul className="space-y-2">{model.entries.map((entry, index) => (entry.type === "relation" ? relationCard(entry, index) : null))}</ul>
        <AddButton onClick={() => onChange(addRelation(model))}>{t.addRelation}</AddButton>
      </Section>
    </div>
  );
}
