import { QUADRANT_TITLE_KEY, axisKey, pointKey, quadrantKey, type AxisEnd } from "@/lib/focus/quadrant";
import { useTranslate } from "@/lib/i18n";
import type { QuadrantModel, QuadrantPoint } from "@/lib/quadrant";
import { AddButton, CommitField, DeleteButton, Field, Section } from "./fields";
import { FocusRow } from "./focus";

interface Props {
  model: QuadrantModel;
  onChange(model: QuadrantModel): void;
}

const NEW_POINT_POSITION = 0.5;
const COORDINATE_STEP = "0.05";

export function QuadrantInspector({ model, onChange }: Props) {
  const t = useTranslate();
  const set = (patch: Partial<QuadrantModel>) => onChange({ ...model, ...patch });
  const setQuadrant = (index: number, text: string) =>
    set({ quadrants: model.quadrants.map((name, i) => (i === index ? text : name)) as QuadrantModel["quadrants"] });
  const setPoint = (index: number, patch: Partial<QuadrantPoint>) =>
    set({ points: model.points.map((point, i) => (i === index ? { ...point, ...patch } : point)) });

  const axes: { label: string; key: AxisEnd }[] = [
    { label: t.xAxisLeft, key: "xLeft" },
    { label: t.xAxisRight, key: "xRight" },
    { label: t.yAxisBottom, key: "yBottom" },
    { label: t.yAxisTop, key: "yTop" },
  ];
  const quadrantLabels = [t.quadrant1, t.quadrant2, t.quadrant3, t.quadrant4];

  const coordinateField = (point: QuadrantPoint, index: number, axis: "x" | "y", label: string) => (
    <Field label={label}>
      <CommitField
        type="number"
        inputMode="decimal"
        step={COORDINATE_STEP}
        ariaLabel={label}
        value={String(point[axis])}
        onCommit={(text) => {
          const value = Number.parseFloat(text);
          if (Number.isFinite(value)) setPoint(index, { [axis]: value });
        }}
      />
    </Field>
  );

  return (
    <div data-testid="quadrant-inspector">
      <Section>
        <FocusRow as="div" focusKey={QUADRANT_TITLE_KEY} className="rounded-md">
          <Field label={t.diagramTitle} htmlFor="quadrant-title">
            <CommitField id="quadrant-title" value={model.title} onCommit={(title) => set({ title })} />
          </Field>
        </FocusRow>
      </Section>
      <Section title={t.axesTitle}>
        {axes.map(({ label, key }) => (
          <FocusRow as="div" key={key} focusKey={axisKey(key)} className="rounded-md">
            <Field label={label}>
              <CommitField ariaLabel={label} value={model[key]} onCommit={(text) => set({ [key]: text })} />
            </Field>
          </FocusRow>
        ))}
      </Section>
      <Section title={t.quadrantsTitle}>
        {quadrantLabels.map((label, index) => (
          <FocusRow as="div" key={index} focusKey={quadrantKey(index)} className="rounded-md">
            <Field label={label}>
              <CommitField ariaLabel={label} value={model.quadrants[index] ?? ""} onCommit={(text) => setQuadrant(index, text)} />
            </Field>
          </FocusRow>
        ))}
      </Section>
      <Section title={t.pointsTitle}>
        <ul className="space-y-3">
          {model.points.map((point, index) => (
            <FocusRow key={index} focusKey={pointKey(index)} className="space-y-1.5 rounded-md border p-2" data-testid="quadrant-point">
              <div className="flex items-center gap-2">
                <CommitField className="flex-1" ariaLabel={t.nameLabel} value={point.name} onCommit={(name) => setPoint(index, { name })} />
                <DeleteButton label={t.delete} onClick={() => set({ points: model.points.filter((_, i) => i !== index) })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {coordinateField(point, index, "x", t.pointX)}
                {coordinateField(point, index, "y", t.pointY)}
              </div>
            </FocusRow>
          ))}
        </ul>
        <AddButton onClick={() => set({ points: [...model.points, { name: t.newNodeLabel, x: NEW_POINT_POSITION, y: NEW_POINT_POSITION, style: "" }] })}>{t.addPoint}</AddButton>
      </Section>
    </div>
  );
}
