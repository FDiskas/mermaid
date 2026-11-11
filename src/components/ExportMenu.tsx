import { Check, Copy, Download, FileCode2, ImageDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { copyPngToClipboard, downloadBlob, exportFilename, svgToBlob, svgToPngBlob } from "@/lib/export";
import { useTranslate } from "@/lib/i18n";
import type { RenderedDiagram } from "@/lib/mermaid-runtime";

const SCALES = [1, 2, 3, 4] as const;

interface Props {
  diagram: RenderedDiagram | null;
  /** Colour behind the diagram when the background is not transparent. */
  background: string;
  scale: number;
  onScaleChange(scale: number): void;
  transparent: boolean;
  onTransparentChange(transparent: boolean): void;
  onNotify(message: string): void;
}

export function ExportMenu({ diagram, background, scale, onScaleChange, transparent, onTransparentChange, onNotify }: Props) {
  const t = useTranslate();
  const png = () => (diagram ? svgToPngBlob(diagram, { scale, background: transparent ? null : background }) : Promise.reject(new Error("Nothing to export")));
  const run = (task: () => Promise<void>) => task().catch((error) => {
    console.error(error);
    onNotify(t.exportFailed);
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" disabled={!diagram} data-testid="export-trigger">
          <Download /> <span className="hidden sm:inline">{t.exportDrawing}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem data-testid="export-png" onSelect={() => run(async () => downloadBlob(await png(), exportFilename("png")))}>
          <ImageDown /> {t.exportPng}
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="export-svg" onSelect={() => run(async () => {
              if (diagram) downloadBlob(svgToBlob(diagram), exportFilename("svg"));
            })}>
          <FileCode2 /> {t.exportSvg}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="export-copy"
          onSelect={() =>
            run(async () => {
              await copyPngToClipboard(await png());
              onNotify(t.copied);
            })
          }
        >
          <Copy /> {t.copyImage}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between gap-3 px-2 py-1.5">
          <span className="text-muted-foreground text-xs">{t.exportScale}</span>
          <ToggleGroup type="single" variant="outline" size="sm" value={String(scale)} onValueChange={(value) => value && onScaleChange(Number(value))}>
            {SCALES.map((s) => (
              <ToggleGroupItem key={s} value={String(s)} className="h-7 px-2.5 text-xs">
                {s}x
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm">
          <Checkbox checked={transparent} onCheckedChange={(value) => onTransparentChange(value === true)} data-testid="export-transparent" />
          {t.transparentBackground}
          {transparent && <Check className="text-primary ml-auto size-4" />}
        </label>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
