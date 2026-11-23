import { useTranslate } from "@/lib/i18n";
import {
  LEFT_CARDINALITIES,
  RELATION_LINES,
  RIGHT_CARDINALITIES,
  addEntity,
  addRelationship,
  canMove,
  canRename,
  entityNames,
  moveEntry,
  newAttribute,
  removeEntry,
  renameEntity,
  updateEntity,
  updateRelationship,
  type Attribute,
  type Entity,
  type ErModel,
  type LeftCardinality,
  type Relationship,
  type RightCardinality,
} from "@/lib/er";
import { AddButton, CommitField, DeleteButton, MoveButtons, SelectField, Section } from "./fields";
import { FocusRow } from "./focus";

interface Props {
  model: ErModel;
  onChange(model: ErModel): void;
}

const LEFT_LABELS = { "||": "erExactlyOne", "|o": "erZeroOrOne", "}|": "erOneOrMore", "}o": "erZeroOrMore" } as const satisfies Record<LeftCardinality, string>;
const RIGHT_LABELS = { "||": "erExactlyOne", "o|": "erZeroOrOne", "|{": "erOneOrMore", "o{": "erZeroOrMore" } as const satisfies Record<RightCardinality, string>;
const NEW_ENTITY_NAME = "ENTITY";
const NEW_ENTITY_ATTRIBUTE = "id";

export function ErInspector({ model, onChange }: Props) {
  const t = useTranslate();
  const nameOptions = entityNames(model).map((name) => ({ value: name, label: name }));
  const leftOptions = LEFT_CARDINALITIES.map((mark) => ({ value: mark, label: `${mark}  ${t[LEFT_LABELS[mark]]}` }));
  const rightOptions = RIGHT_CARDINALITIES.map((mark) => ({ value: mark, label: `${mark}  ${t[RIGHT_LABELS[mark]]}` }));
  const lineOptions = RELATION_LINES.map((line) => ({ value: line, label: `${line}  ${line === "--" ? t.erIdentifying : t.erNonIdentifying}` }));

  const controls = (index: number) => (
    <>
      <MoveButtons canMoveUp={canMove(model, index, -1)} canMoveDown={canMove(model, index, 1)} upLabel={t.moveUp} downLabel={t.moveDown} onMove={(step) => onChange(moveEntry(model, index, step))} />
      <DeleteButton label={t.delete} onClick={() => onChange(removeEntry(model, index))} />
    </>
  );

  const entityCard = (entry: Entity, index: number) => {
    const setAttributes = (attributes: Attribute[]) => onChange(updateEntity(model, index, { attributes }));
    const patchAttribute = (position: number, change: Partial<Attribute>) => setAttributes(entry.attributes.map((attribute, i) => (i === position ? { ...attribute, ...change } : attribute)));
    return (
      <FocusRow key={index} focusKey={String(index)} className="space-y-2 rounded-md border p-2" data-testid="er-entity">
        <div className="flex items-center gap-1">
          {canRename(model, index) ? (
            <CommitField className="flex-1 font-medium" ariaLabel={t.entityName} value={entry.name} onCommit={(name) => onChange(renameEntity(model, index, name))} />
          ) : (
            <span className="min-w-0 flex-1 truncate px-1 text-sm font-medium" title={t.nameInUse} aria-label={t.entityName}>
              {entry.name}
            </span>
          )}
          {controls(index)}
        </div>
        {entry.attributes.map((attribute, position) => (
          <div key={position} className="space-y-1 rounded border border-dashed p-1.5" data-testid="er-attribute">
            <div className="flex items-center gap-1">
              <CommitField className="w-24" ariaLabel={t.attributeType} placeholder={t.attributeType} value={attribute.type} onCommit={(type) => patchAttribute(position, { type })} />
              <CommitField className="flex-1" ariaLabel={t.attributeName} placeholder={t.attributeName} value={attribute.name} onCommit={(name) => patchAttribute(position, { name })} />
              <DeleteButton label={t.delete} onClick={() => setAttributes(entry.attributes.filter((_, i) => i !== position))} />
            </div>
            <div className="flex items-center gap-1">
              <CommitField className="w-24" ariaLabel={t.attributeKeys} placeholder="PK, FK" value={attribute.keys.join(", ")} onCommit={(keys) => patchAttribute(position, { keys: keys.split(",").map((key) => key.trim().toUpperCase()).filter(Boolean) })} />
              <CommitField className="flex-1" ariaLabel={t.attributeComment} placeholder={t.attributeComment} value={attribute.comment} onCommit={(comment) => patchAttribute(position, { comment })} />
            </div>
          </div>
        ))}
        <AddButton onClick={() => setAttributes([...entry.attributes, newAttribute(NEW_ENTITY_ATTRIBUTE)])}>{t.addAttribute}</AddButton>
      </FocusRow>
    );
  };

  const relationshipCard = (entry: Relationship, index: number) => {
    const patch = (change: Partial<Relationship>) => onChange(updateRelationship(model, index, change));
    return (
      <FocusRow key={index} focusKey={String(index)} className="space-y-2 rounded-md border p-2" data-testid="er-relationship">
        <div className="flex items-center gap-1">
          <SelectField className="min-w-0 flex-1" ariaLabel={t.linkFrom} value={entry.left} options={nameOptions} onChange={(left) => patch({ left })} />
          <SelectField className="min-w-0 flex-1" ariaLabel={t.linkTo} value={entry.right} options={nameOptions} onChange={(right) => patch({ right })} />
        </div>
        <SelectField className="w-full" ariaLabel={t.cardinalityFrom} value={entry.leftCardinality} options={leftOptions} onChange={(leftCardinality) => patch({ leftCardinality })} />
        <SelectField className="w-full" ariaLabel={t.cardinalityTo} value={entry.rightCardinality} options={rightOptions} onChange={(rightCardinality) => patch({ rightCardinality })} />
        <div className="flex items-center gap-1">
          <SelectField className="min-w-0 flex-1" ariaLabel={t.relationLine} value={entry.line} options={lineOptions} onChange={(line) => patch({ line })} />
          {controls(index)}
        </div>
        <CommitField ariaLabel={t.linkLabel} value={entry.label} onCommit={(label) => patch({ label })} />
      </FocusRow>
    );
  };

  return (
    <div data-testid="er-inspector">
      <Section title={t.entities}>
        <ul className="space-y-2">{model.entries.map((entry, index) => (entry.type === "entity" ? entityCard(entry, index) : null))}</ul>
        <AddButton onClick={() => onChange(addEntity(model, NEW_ENTITY_NAME, NEW_ENTITY_ATTRIBUTE))}>{t.addEntity}</AddButton>
      </Section>
      <Section title={t.relations}>
        <ul className="space-y-2">{model.entries.map((entry, index) => (entry.type === "relationship" ? relationshipCard(entry, index) : null))}</ul>
        <AddButton onClick={() => onChange(addRelationship(model, t.linkLabel))}>{t.addRelation}</AddButton>
      </Section>
    </div>
  );
}
