import type { CSSProperties } from "react";

// Class strings of the SEED action button as the reference renders them.
type Variant = "ghost" | "brandSolid" | "neutralOutline";
type Size = "xsmall" | "small";
type Layout = "withText" | "iconOnly";

export const ab = (variant: Variant, size: Size = "xsmall", layout: Layout = "withText") =>
  `seed-action-button seed-action-button--variant_${variant} seed-action-button--size_${size} seed-action-button--layout_${layout} seed-action-button--size_${size}-layout_${layout} seed-scale-feedback`;

/** shared tail of the reference's small icon buttons */
export const AB_TAIL = "shrink-0 touch-manipulation select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

export const seedSize = (w: number, h: number) => ({ "--seed-element-width": String(w), "--seed-element-height": String(h) }) as CSSProperties;
