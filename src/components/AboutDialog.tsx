import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslate } from "@/lib/i18n";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function AboutDialog({ open, onOpenChange }: Props) {
  const t = useTranslate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.aboutTitle}</DialogTitle>
          <DialogDescription className="leading-relaxed">{t.aboutBody}</DialogDescription>
        </DialogHeader>
        <p className="text-muted-foreground text-xs">Mermaid.js · CodeMirror · React · Tailwind CSS · shadcn/ui · Bun</p>
      </DialogContent>
    </Dialog>
  );
}
