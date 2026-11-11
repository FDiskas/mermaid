import { CLASSIC_SHAPES, type ClassicShape } from "@/lib/flowchart/model";
import { useTranslate } from "@/lib/i18n";
import type { translate } from "@/lib/translate";
import { cn } from "@/lib/utils";

const SHAPE_LABEL: Record<ClassicShape, keyof typeof translate> = {
  square: "shapeSquare",
  round: "shapeRound",
  stadium: "shapeStadium",
  subroutine: "shapeSubroutine",
  cylinder: "shapeCylinder",
  circle: "shapeCircle",
  doublecircle: "shapeDoubleCircle",
  diamond: "shapeDiamond",
  hexagon: "shapeHexagon",
  odd: "shapeOdd",
  trapezoid: "shapeTrapezoid",
  inv_trapezoid: "shapeTrapezoidInv",
  lean_right: "shapeParallelogram",
  lean_left: "shapeParallelogramAlt",
};

function Glyph({ shape }: { shape: ClassicShape }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinejoin: "round" as const };
  switch (shape) {
    case "square":
      return <rect x="3" y="3" width="18" height="10" {...common} />;
    case "round":
      return <rect x="3" y="3" width="18" height="10" rx="3.5" {...common} />;
    case "stadium":
      return <rect x="3" y="3" width="18" height="10" rx="5" {...common} />;
    case "subroutine":
      return (
        <g {...common}>
          <rect x="3" y="3" width="18" height="10" />
          <path d="M6 3v10M18 3v10" />
        </g>
      );
    case "cylinder":
      return (
        <g {...common}>
          <path d="M5 4v8c0 1.1 3.1 2 7 2s7-.9 7-2V4" />
          <ellipse cx="12" cy="4" rx="7" ry="2" />
        </g>
      );
    case "circle":
      return <circle cx="12" cy="8" r="5.5" {...common} />;
    case "doublecircle":
      return (
        <g {...common}>
          <circle cx="12" cy="8" r="6" />
          <circle cx="12" cy="8" r="3.8" />
        </g>
      );
    case "diamond":
      return <polygon points="12,1.5 21,8 12,14.5 3,8" {...common} />;
    case "hexagon":
      return <polygon points="6,2.5 18,2.5 22,8 18,13.5 6,13.5 2,8" {...common} />;
    case "odd":
      return <polygon points="3,3 21,3 21,13 3,13 7,8" {...common} />;
    case "trapezoid":
      return <polygon points="6,3 18,3 21,13 3,13" {...common} />;
    case "inv_trapezoid":
      return <polygon points="3,3 21,3 18,13 6,13" {...common} />;
    case "lean_right":
      return <polygon points="7,3 21,3 17,13 3,13" {...common} />;
    case "lean_left":
      return <polygon points="3,3 17,3 21,13 7,13" {...common} />;
  }
}

interface Props {
  value: string;
  onChange(shape: ClassicShape): void;
}

export function ShapePicker({ value, onChange }: Props) {
  const t = useTranslate();
  return (
    <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={t.nodeShape}>
      {CLASSIC_SHAPES.map((shape) => {
        const label = t[SHAPE_LABEL[shape]] as string;
        const active = shape === value || (shape === "square" && value === "rect");
        return (
          <button
            key={shape}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            data-shape={shape}
            onClick={() => onChange(shape)}
            className={cn(
              "text-muted-foreground hover:bg-accent hover:text-foreground grid h-9 place-items-center rounded-md border transition-colors",
              active && "border-primary bg-primary/10 text-primary",
            )}
          >
            <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden>
              <Glyph shape={shape} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
