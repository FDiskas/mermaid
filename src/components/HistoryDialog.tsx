import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Snapshot } from "@/hooks/useSnapshots";
import { useLanguage, useTranslate } from "@/lib/i18n";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  snapshots: Snapshot[];
  onRestore(snapshot: Snapshot): void;
  onRemove(id: string): void;
}

export function HistoryDialog({ open, onOpenChange, snapshots, onRestore, onRemove }: Props) {
  const t = useTranslate();
  const { language } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.historyTitle}</DialogTitle>
          <DialogDescription>{t.historyDescription}</DialogDescription>
        </DialogHeader>
        {snapshots.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">{t.historyEmpty}</p>
        ) : (
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1" data-testid="history-list">
            {snapshots.map((snapshot) => (
              <li key={snapshot.id} className="flex items-center gap-3 rounded-md border p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium">{new Date(snapshot.time).toLocaleString(language)}</div>
                  <pre className="text-muted-foreground mt-1 max-h-12 overflow-hidden font-mono text-xs leading-snug">
                    {snapshot.code.split("\n").slice(0, 3).join("\n")}
                  </pre>
                </div>
                <Button size="sm" variant="outline" onClick={() => onRestore(snapshot)}>
                  <RotateCcw /> {t.restore}
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={t.delete} title={t.delete} onClick={() => onRemove(snapshot.id)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
