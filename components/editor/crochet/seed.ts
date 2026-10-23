// Class strings of the SEED action button as the reference editor renders them.
import type { CSSProperties } from "react";

type Variant = "ghost" | "brandSolid" | "neutralOutline";
type Size = "xsmall" | "small";
type Layout = "withText" | "iconOnly";

export const sab = (variant: Variant, size: Size = "xsmall", layout: Layout = "withText") =>
  `seed-action-button seed-action-button--variant_${variant} seed-action-button--size_${size} seed-action-button--layout_${layout} seed-action-button--size_${size}-layout_${layout} seed-scale-feedback`;

/** shadcn-style wrapper classes the reference adds around SEED buttons. */
export const BTN = "shrink-0 touch-manipulation select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
export const BTN_TOOL = "shrink-0 select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

/** SEED's press-scale feedback reads the element size from these custom properties. */
export const el = (w: number, h: number) => ({ "--seed-element-width": String(w), "--seed-element-height": String(h) }) as CSSProperties;
