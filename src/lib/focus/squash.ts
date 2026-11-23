/**
 * The text without any white space. Mermaid wraps long labels into rows (`<tspan>`s) that touch each other,
 * so the text of an element has no space where the row breaks. Compare texts in this form.
 */
export const squash = (text: string | null | undefined): string => (text ?? "").replace(/\s+/g, "");
