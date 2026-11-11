import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslate } from "@/lib/i18n";

const REPOSITORY_URL = "https://github.com/FDiskas/mermaid";

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
        <a
          href={REPOSITORY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary w-fit text-sm underline underline-offset-4 hover:no-underline"
        >
          {t.aboutSourceCode}
        </a>
        <p className="text-muted-foreground text-xs">Mermaid.js · CodeMirror · React · Tailwind CSS · shadcn/ui · Bun</p>
      </DialogContent>
    </Dialog>
  );
}
