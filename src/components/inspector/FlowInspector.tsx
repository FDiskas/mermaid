import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Cable, Plus, Trash2, Ungroup, ArrowLeftRight, Group } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import {
  isClassicShape,
  labelToText,
  type Direction,
  type FlowModel,
  type HeadMarker,
  type Selection,
  type Stroke,
} from "@/lib/flowchart/model";
import { addEdge, addNode, duplicateNode, groupItems, removeEdge, removeNode, reverseEdge, setDirection, setEdgeBothEnds, setEdgeHead, ungroup, updateEdge, updateGroup, updateNode } from "@/lib/flowchart/ops";
import { getStyleProp, parsePixels, setStyleProp, toHexColor } from "@/lib/flowchart/styles";
import { useTranslate } from "@/lib/i18n";
import { withParams } from "@/lib/translate";
import { ColorField, CommitField, Field, Section } from "./fields";
import { ShapePicker } from "./ShapePicker";

const FILL_PRESETS = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#ddd6fe", "#fecaca", "#e5e7eb", "#ffffff"];

interface Props {
  model: FlowModel;
  selection: Selection;
  /** Every selected element. More than one when several are selected. */
  selected: NonNullable<Selection>[];
  /** `nextSelection`: undefined keeps the current selection, null clears it. */
  onChange(model: FlowModel, nextSelection?: Selection): void;
  onStartConnect(sourceId: string): void;
  /** Colours Mermaid drew for the selected element, shown when the user has not set any. */
  renderedColors(selection: NonNullable<Selection>): { fill?: string; stroke?: string; color?: string };
  focusToken: number;
}

export function FlowInspector({ model, selection, selected, onChange, onStartConnect, renderedColors, focusToken }: Props) {
  const t = useTranslate();
  const node = selection?.kind === "node" ? model.nodes.find((n) => n.id === selection.id) : undefined;
  const edge = selection?.kind === "edge" ? model.edges.find((e) => e.id === selection.id) : undefined;
  const group = selection?.kind === "group" ? model.groups.find((g) => g.id === selection.id) : undefined;

  if (selected.length > 1) {
    const ids = selected.filter((item) => item.kind !== "edge").map((item) => item.id);
    return (
      <div data-testid="multi-inspector">
        <Section title={withParams(t.selectedCount(selected.length), { count: selected.length })}>
          <p className="text-muted-foreground text-xs leading-relaxed">{t.multiSelectHint}</p>
        </Section>
        <Section>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            data-testid="group-selected"
            onClick={() => {
              const grouped = groupItems(model, ids, t.newGroupTitle);
              if (grouped.id) onChange(grouped.model, { kind: "group", id: grouped.id });
            }}
          >
            <Group /> {t.groupSelected}
          </Button>
        </Section>
      </div>
    );
  }

  if (node && selection) {
    const colors = renderedColors(selection);
    const style = (key: string, value: string | undefined) => onChange(updateNode(model, node.id, { styles: setStyleProp(node.styles, key, value) }));
    return (
      <div data-testid="node-inspector">
        <Section title={`${t.kindNode} · ${node.id}`}>
          <Field label={t.nodeLabel} htmlFor="node-label">
            <CommitField
              id="node-label"
              multiline
              focusToken={focusToken}
              value={labelToText(node.label)}
              onCommit={(text) => onChange(updateNode(model, node.id, { label: text }))}
            />
          </Field>
          <Field label={t.nodeShape}>
            {isClassicShape(node.shape) || node.shape === "rect" ? (
              <ShapePicker value={node.shape} onChange={(shape) => onChange(updateNode(model, node.id, { shape }))} />
            ) : (
              <p className="text-muted-foreground text-xs">
                {t.shapeCustom}: <code>{node.shape}</code>
              </p>
            )}
          </Field>
        </Section>
        <Section>
          <ColorField
            label={t.fillColor}
            value={toHexColor(getStyleProp(node.styles, "fill"))}
            fallback={toHexColor(colors.fill) ?? "#ffffff"}
            presets={FILL_PRESETS}
            onChange={(color) => style("fill", color)}
            onClear={() => style("fill", undefined)}
          />
          <ColorField
            label={t.strokeColor}
            value={toHexColor(getStyleProp(node.styles, "stroke"))}
            fallback={toHexColor(colors.stroke) ?? "#333333"}
            onChange={(color) => style("stroke", color)}
            onClear={() => style("stroke", undefined)}
          />
          <ColorField
            label={t.textColor}
            value={toHexColor(getStyleProp(node.styles, "color"))}
            fallback={toHexColor(colors.color) ?? "#000000"}
            onChange={(color) => style("color", color)}
            onClear={() => style("color", undefined)}
          />
          <Field label={t.strokeWidth}>
            <CommitField
              type="number"
              inputMode="decimal"
              value={String(parsePixels(getStyleProp(node.styles, "stroke-width")) ?? "")}
              onCommit={(text) => {
                const n = Number.parseFloat(text);
                style("stroke-width", Number.isFinite(n) && n >= 0 ? `${Math.min(n, 20)}px` : undefined);
              }}
            />
          </Field>
          {node.styles.length > 0 && (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(updateNode(model, node.id, { styles: [] }))}>
              {t.resetStyle}
            </Button>
          )}
        </Section>
        <Section className="grid grid-cols-2 gap-2 space-y-0">
          <Button
            variant="outline"
            size="sm"
            className="col-span-2"
            onClick={() => {
              const next = addNode(model, { label: t.newNodeLabel, connectFrom: node.id });
              onChange(next.model, { kind: "node", id: next.id });
            }}
          >
            <Plus /> {t.addConnected}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onStartConnect(node.id)}>
            <Cable /> {t.connectTo}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const copy = duplicateNode(model, node.id);
              onChange(copy.model, { kind: "node", id: copy.id });
            }}
          >
            <Copy /> {t.duplicate}
          </Button>
          <Button variant="outline" size="sm" className="text-destructive col-span-2" onClick={() => onChange(removeNode(model, node.id), null)}>
            <Trash2 /> {t.delete}
          </Button>
        </Section>
      </div>
    );
  }

  if (edge && selection) {
    const colors = renderedColors(selection);
    const setStroke = (value: string | undefined) => onChange(updateEdge(model, edge.id, { styles: setStyleProp(edge.styles, "stroke", value) }));
    return (
      <div data-testid="edge-inspector">
        <Section title={`${t.kindEdge} · ${edge.from} → ${edge.to}`}>
          <Field label={t.edgeLabel} htmlFor="edge-label">
            <CommitField id="edge-label" value={labelToText(edge.label)} focusToken={focusToken} onCommit={(text) => onChange(updateEdge(model, edge.id, { label: text }))} />
          </Field>
          <Field label={t.lineStyle}>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={edge.stroke}
              onValueChange={(value) => value && onChange(updateEdge(model, edge.id, { stroke: value as Stroke }))}
            >
              <ToggleGroupItem value="normal">{t.lineSolid}</ToggleGroupItem>
              <ToggleGroupItem value="dotted">{t.lineDotted}</ToggleGroupItem>
              <ToggleGroupItem value="thick">{t.lineThick}</ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <Field label={t.arrowHead}>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={edge.head}
              onValueChange={(value) => value && onChange(setEdgeHead(model, edge.id, value as HeadMarker))}
            >
              <ToggleGroupItem value="arrow">{t.arrowNormal}</ToggleGroupItem>
              <ToggleGroupItem value="open">{t.arrowOpen}</ToggleGroupItem>
              <ToggleGroupItem value="cross">{t.arrowCross}</ToggleGroupItem>
              <ToggleGroupItem value="circle">{t.arrowCircle}</ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <label className="flex items-center justify-between gap-3 text-sm">
            {t.bothDirections}
            <Switch
              checked={edge.tail !== "none"}
              disabled={edge.head === "open"}
              onCheckedChange={(on) => onChange(setEdgeBothEnds(model, edge.id, on))}
            />
          </label>
        </Section>
        <Section>
          <ColorField
            label={t.strokeColor}
            value={toHexColor(getStyleProp(edge.styles, "stroke"))}
            fallback={toHexColor(colors.stroke) ?? "#333333"}
            onChange={setStroke}
            onClear={() => setStroke(undefined)}
          />
        </Section>
        <Section className="grid grid-cols-1 gap-2 space-y-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const flipped = reverseEdge(model, edge.id);
              onChange(flipped.model, { kind: "edge", id: flipped.id });
            }}
          >
            <ArrowLeftRight /> {t.reverseEdge}
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => onChange(removeEdge(model, edge.id), null)}>
            <Trash2 /> {t.delete}
          </Button>
        </Section>
      </div>
    );
  }

  if (group && selection) {
    return (
      <div data-testid="group-inspector">
        <Section title={`${t.kindGroup} · ${group.id}`}>
          <Field label={t.groupTitle} htmlFor="group-title">
            <CommitField id="group-title" value={group.title} focusToken={focusToken} onCommit={(text) => onChange(updateGroup(model, group.id, { title: text }))} />
          </Field>
        </Section>
        <Section>
          <Button variant="outline" size="sm" className="w-full" onClick={() => onChange(ungroup(model, group.id), null)}>
            <Ungroup /> {t.ungroup}
          </Button>
        </Section>
      </div>
    );
  }

  const directions: [Direction, typeof ArrowDown, string][] = [
    ["TB", ArrowDown, t.dirTB],
    ["LR", ArrowRight, t.dirLR],
    ["BT", ArrowUp, t.dirBT],
    ["RL", ArrowLeft, t.dirRL],
  ];
  return (
    <div data-testid="diagram-inspector">
      <Section>
        <p className="text-muted-foreground text-sm leading-relaxed">{t.selectHint}</p>
        <p className="text-muted-foreground text-xs">
          {withParams(t.nodesCount(model.nodes.length), { count: model.nodes.length })} ·{" "}
          {withParams(t.edgesCount(model.edges.length), { count: model.edges.length })}
        </p>
      </Section>
      <Section>
        <Field label={t.direction}>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={model.direction}
            onValueChange={(value) => value && onChange(setDirection(model, value as Direction))}
          >
            {directions.map(([value, Icon, label]) => (
              <ToggleGroupItem key={value} value={value} aria-label={label} title={label}>
                <Icon />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            const next = addNode(model, { label: t.newNodeLabel });
            onChange(next.model, { kind: "node", id: next.id });
          }}
        >
          <Plus /> {t.addNode}
        </Button>
      </Section>
      <Section>
        <p className="text-muted-foreground text-xs">{t.rewriteWarning}</p>
      </Section>
    </div>
  );
}
