import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mindmapNodeKey } from "@/lib/focus/mindmap";
import { useTranslate } from "@/lib/i18n";
import { changeNode, newMindNode, type MindNode, type MindmapModel, type NodePath } from "@/lib/mindmap";
import { AddButton, CommitField, DeleteButton, Section } from "./fields";
import { FocusRow } from "./focus";

interface Props {
  model: MindmapModel;
  onChange(model: MindmapModel): void;
}

const INDENT_PX = 14;

interface BranchProps {
  nodes: MindNode[];
  parent: NodePath;
  edit(path: NodePath, change: (node: MindNode) => MindNode | null): void;
}

/** The nodes of one level, each followed by its own children one step further right. */
function Branch({ nodes, parent, edit }: BranchProps) {
  const t = useTranslate();
  return (
    <ul className="space-y-1.5">
      {nodes.map((node, index) => {
        const path = [...parent, index];
        return (
          <li key={index} data-testid="mindmap-node">
            <FocusRow as="div" focusKey={mindmapNodeKey(path)} className="flex items-center gap-1 rounded-md">
              <CommitField className="flex-1" ariaLabel={t.nodeText} value={node.text} onCommit={(text) => edit(path, (n) => ({ ...n, text }))} />
              <Button variant="ghost" size="icon-sm" aria-label={t.addChild} title={t.addChild} onClick={() => edit(path, (n) => ({ ...n, children: [...n.children, newMindNode(t.newNodeLabel)] }))}>
                <Plus />
              </Button>
              <DeleteButton label={t.delete} onClick={() => edit(path, () => null)} />
            </FocusRow>
            {node.children.length > 0 && (
              <div className="mt-1.5" style={{ marginLeft: INDENT_PX }}>
                <Branch nodes={node.children} parent={path} edit={edit} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function MindmapInspector({ model, onChange }: Props) {
  const t = useTranslate();
  return (
    <div data-testid="mindmap-inspector">
      <Section>
        <Branch nodes={model.roots} parent={[]} edit={(path, change) => onChange({ ...model, roots: changeNode(model.roots, path, change) })} />
        {model.roots.length === 0 && <AddButton onClick={() => onChange({ ...model, roots: [newMindNode(t.newNodeLabel)] })}>{t.addNode}</AddButton>}
      </Section>
    </div>
  );
}
