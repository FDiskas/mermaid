/** Helpers for Mermaid style declarations such as `["fill:#f9f", "stroke-width:4px"]`. */

export function getStyleProp(styles: string[], key: string): string | undefined {
  for (const entry of styles) {
    const index = entry.indexOf(":");
    if (index === -1) continue;
    if (entry.slice(0, index).trim() === key) return entry.slice(index + 1).trim();
  }
  return undefined;
}

/** Returns a new list with `key` set to `value`, or removed when `value` is empty/undefined. */
export function setStyleProp(styles: string[], key: string, value: string | undefined): string[] {
  const rest = styles.filter((entry) => entry.slice(0, entry.indexOf(":")).trim() !== key);
  return value ? [...rest, `${key}:${value}`] : rest;
}

/** Normalises `#abc` and `#aabbcc` to `#aabbcc` for `<input type="color">`. Returns undefined for anything else. */
export function toHexColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(v);
  if (rgb) return "#" + [rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
  return undefined;
}

export function parsePixels(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}
