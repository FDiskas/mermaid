import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTranslate } from "@/lib/i18n";
import type { PieModel } from "@/lib/pie";
import { CommitField, Field, Section } from "./fields";

interface Props {
  model: PieModel;
  onChange(model: PieModel): void;
}

export function PieInspector({ model, onChange }: Props) {
  const t = useTranslate();
  const setSlice = (index: number, patch: Partial<PieModel["slices"][number]>) =>
    onChange({ ...model, slices: model.slices.map((s, i) => (i === index ? { ...s, ...patch } : s)) });

  return (
    <div data-testid="pie-inspector">
      <Section>
        <Field label={t.pieTitle} htmlFor="pie-title">
          <CommitField id="pie-title" value={model.title} onCommit={(title) => onChange({ ...model, title })} />
        </Field>
        <label className="flex items-center justify-between gap-3 text-sm">
          {t.showData}
          <Switch checked={model.showData} onCheckedChange={(showData) => onChange({ ...model, showData })} />
        </label>
      </Section>
      <Section title={t.slices}>
        <ul className="space-y-2">
          {model.slices.map((slice, index) => (
            <li key={index} className="flex items-center gap-2" data-testid="pie-slice">
              <CommitField className="flex-1" value={slice.label} onCommit={(label) => setSlice(index, { label })} />
              <CommitField
                className="w-20"
                type="number"
                inputMode="decimal"
                value={String(slice.value)}
                onCommit={(text) => {
                  const value = Number.parseFloat(text);
                  if (Number.isFinite(value)) setSlice(index, { value });
                }}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t.delete}
                title={t.delete}
                onClick={() => onChange({ ...model, slices: model.slices.filter((_, i) => i !== index) })}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ ...model, slices: [...model.slices, { label: t.newNodeLabel, value: 10 }] })}>
          <Plus /> {t.addSlice}
        </Button>
      </Section>
    </div>
  );
}
