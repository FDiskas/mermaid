import { useTranslate } from "@/lib/i18n";
import {
  addBranch,
  addCheckout,
  addCommit,
  addMerge,
  branchNames,
  canMove,
  canRenameBranch,
  moveEntry,
  removeEntry,
  renameBranch,
  updateEntry,
  type Commit,
  type GitModel,
  type Merge,
} from "@/lib/git-graph";
import { AddButton, CommitField, DeleteButton, MoveButtons, SelectField, Section } from "./fields";

interface Props {
  model: GitModel;
  onChange(model: GitModel): void;
}

const NEW_BRANCH_NAME = "develop";

export function GitInspector({ model, onChange }: Props) {
  const t = useTranslate();
  const branchOptions = branchNames(model).map((name) => ({ value: name, label: name }));
  const typeOptions = [
    { value: "", label: t.commitNormal },
    { value: "REVERSE", label: t.commitReverse },
    { value: "HIGHLIGHT", label: t.commitHighlight },
  ];

  /** The id, tag and type fields that a commit and a merge share. */
  const optionFields = (entry: Commit | Merge, index: number) => (
    <div className="flex items-center gap-1">
      <CommitField className="w-20" ariaLabel={t.commitId} placeholder={t.commitId} value={entry.id} onCommit={(id) => onChange(updateEntry(model, index, { id }))} />
      <CommitField className="min-w-0 flex-1" ariaLabel={t.commitTag} placeholder={t.commitTag} value={entry.tag} onCommit={(tag) => onChange(updateEntry(model, index, { tag }))} />
      <SelectField
        className="w-28"
        ariaLabel={t.attributeType}
        value={entry.commitType === "NORMAL" ? "" : entry.commitType}
        options={typeOptions}
        onChange={(commitType) => onChange(updateEntry(model, index, { commitType }))}
      />
    </div>
  );

  return (
    <div data-testid="git-inspector">
      <Section title={t.gitCommands}>
        <ul className="space-y-2">
          {model.entries.map((entry, index) => {
            if (entry.type === "raw") return null;
            const title = { commit: t.gitCommit, branch: t.gitBranch, checkout: t.gitCheckout, merge: t.gitMerge }[entry.type];
            return (
              <li key={index} className="space-y-2 rounded-md border p-2" data-testid="git-command">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground flex-1 px-1 text-xs font-semibold tracking-wide uppercase">{title}</span>
                  <MoveButtons canMoveUp={canMove(model, index, -1)} canMoveDown={canMove(model, index, 1)} upLabel={t.moveUp} downLabel={t.moveDown} onMove={(step) => onChange(moveEntry(model, index, step))} />
                  <DeleteButton label={t.delete} onClick={() => onChange(removeEntry(model, index))} />
                </div>
                {entry.type === "commit" && optionFields(entry, index)}
                {entry.type === "branch" &&
                  (canRenameBranch(model, index) ? (
                    <CommitField ariaLabel={t.branchName} value={entry.name} onCommit={(name) => onChange(renameBranch(model, index, name))} />
                  ) : (
                    <span className="block truncate px-1 text-sm" title={t.nameInUse} aria-label={t.branchName}>
                      {entry.name}
                    </span>
                  ))}
                {entry.type === "checkout" && <SelectField className="w-full" ariaLabel={t.branchName} value={entry.name} options={branchOptions} onChange={(name) => onChange(updateEntry(model, index, { name }))} />}
                {entry.type === "merge" && (
                  <>
                    <SelectField className="w-full" ariaLabel={t.branchName} value={entry.name} options={branchOptions} onChange={(name) => onChange(updateEntry(model, index, { name }))} />
                    {optionFields(entry, index)}
                  </>
                )}
              </li>
            );
          })}
        </ul>
        <AddButton onClick={() => onChange(addCommit(model))}>{t.addCommit}</AddButton>
        <AddButton onClick={() => onChange(addBranch(model, NEW_BRANCH_NAME))}>{t.addBranch}</AddButton>
        <AddButton onClick={() => onChange(addCheckout(model))}>{t.addCheckout}</AddButton>
        <AddButton onClick={() => onChange(addMerge(model))}>{t.addMerge}</AddButton>
      </Section>
    </div>
  );
}
