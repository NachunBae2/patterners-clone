// Chart → knitted-look stitches for the 실체화 (β) window.
import type { PChart, PStitch } from "@/components/editor/common/KnitPreview";
import { knitSymbol } from "@/lib/symbols/knitting";
import { rowOwners, type KGrid } from "./model";

type Look = { k: "knit" | "purl" | "yo" | "bobble" | "slip" | "twist" | "none" } | { k: "lean"; dir: -1 | 0 | 1 } | { k: "cable"; a: number; b: number; c: number; leftOver: boolean; purlBg: boolean };

/** how one symbol looks in the fabric; `exact` = false when the drawing is only an approximation */
export function lookOf(id: string | undefined): { look: Look; exact: boolean } {
  if (!id) return { look: { k: "knit" }, exact: true };
  const sym = knitSymbol(id);
  const k = (sym?.id ?? id).slice(2);
  let m: RegExpMatchArray | null;
  // crossings
  if ((m = k.match(/^(lc|rc)(\d)(\d)(\d)(ck|cp)$/))) return { look: { k: "cable", a: +m[2], c: +m[3], b: +m[4], leftOver: m[1] === "lc", purlBg: false }, exact: true };
  if ((m = k.match(/^(lc|rc)_k3$/))) return { look: { k: "cable", a: 1, c: 3, b: 1, leftOver: m[1] === "lc", purlBg: false }, exact: true };
  if ((m = k.match(/^(lc|rc)(22)?_twist(_p)?$/))) {
    const n = m[2] ? 2 : 1;
    return { look: { k: "cable", a: n, b: n, c: 0, leftOver: m[1] === "lc", purlBg: !!m[3] }, exact: true };
  }
  if ((m = k.match(/^(lc|rc)_thru$/))) return { look: { k: "cable", a: 1, b: 1, c: 0, leftOver: m[1] === "lc", purlBg: false }, exact: false };
  if (k === "lc12_p_slip") return { look: { k: "cable", a: 1, b: 2, c: 0, leftOver: true, purlBg: true }, exact: true };
  if (k === "rc12_slip_p") return { look: { k: "cable", a: 2, b: 1, c: 0, leftOver: false, purlBg: true }, exact: true };
  if ((m = k.match(/^(lc|rc)(?:(\d)(\d))?(_p)?$/))) {
    const lc = m[1] === "lc";
    const F = m[2] ? +m[2] : 1;
    const B = m[3] ? +m[3] : 1;
    return { look: lc ? { k: "cable", a: F, b: B, c: 0, leftOver: true, purlBg: !!m[4] } : { k: "cable", a: B, b: F, c: 0, leftOver: false, purlBg: !!m[4] }, exact: true };
  }
  if (k === "knit" || k === "empty") return { look: { k: "knit" }, exact: true };
  if (k === "purl") return { look: { k: "purl" }, exact: true };
  if (k === "blank") return { look: { k: "none" }, exact: true };
  if (/^yo(_tbl|2|3)?$/.test(k)) return { look: { k: "yo" }, exact: k === "yo" };
  if (/^(bobble\d?|nupp\d?)$/.test(k)) return { look: { k: "bobble" }, exact: true };
  if (k === "twist_k" || k === "brk_tbl") return { look: { k: "twist" }, exact: true };
  if (k === "twist_p") return { look: { k: "purl" }, exact: false };
  if (/^(slip|slip_k|slip_tall2|sl\dyo)$/.test(k)) return { look: { k: "slip" }, exact: k === "slip" || k === "slip_k" };
  if (/^(slip_p\d?|slip_p_tall2)$/.test(k)) return { look: { k: "slip" }, exact: false };
  // decreases
  if ((m = k.match(/^(k|p|brk|brp)(\d)tog(_tbl)?$/))) return m[1].endsWith("p") ? { look: { k: "purl" }, exact: false } : { look: { k: "lean", dir: 1 }, exact: true };
  if ((m = k.match(/^(ssk|ssp|brssk|brsssk|brssp|brsssp)(\d)?(_tbl)?$/))) return m[1].endsWith("p") ? { look: { k: "purl" }, exact: false } : { look: { k: "lean", dir: -1 }, exact: true };
  if (k === "sk2p") return { look: { k: "lean", dir: -1 }, exact: true };
  if ((m = k.match(/^(cdd|brcdd)(\d)?$/))) return { look: { k: "lean", dir: 0 }, exact: true };
  if (/^(cddp\d?|brcddp)$/.test(k)) return { look: { k: "purl" }, exact: false };
  // purl-side stitches
  if (/^(brp|bind_off_p|purl_below|dip_purl2|bead_p|elong\dp|m1lp|m1rp|llip|rlip|pfb|inc1to\dp)$/.test(k)) return { look: { k: "purl" }, exact: k === "brp" };
  if (k === "drop") return { look: { k: "none" }, exact: false };
  if (k === "brk" || /^char_|^(pm|sm|sm_l|sm_r)$/.test(k)) return { look: { k: "knit" }, exact: true };
  return { look: { k: "knit" }, exact: false };
}

/** The grid as fabric stitches; cells without a colour use `yarn`. Also lists symbols drawn approximately. */
export function gridToFabric(g: KGrid, yarn: string): { chart: PChart; approx: string[] } {
  const cells: PStitch[] = Array(g.cols * g.rows).fill({ k: "none" });
  const approx = new Map<string, string>();
  for (let r = 0; r < g.rows; r++) {
    const owners = rowOwners(g, r);
    for (let c = 0; c < g.cols; c++) {
      const color = g.cells[r * g.cols + c]?.color ?? yarn;
      const o = owners[c];
      const id = o >= 0 ? g.cells[r * g.cols + o]?.symbol : undefined;
      const { look, exact } = lookOf(id);
      if (!exact && id) approx.set(id, knitSymbol(id)?.name ?? id);
      if (look.k === "cable") {
        if (o !== c) {
          cells[r * g.cols + c] = { k: "covered" };
          continue;
        }
        const w = look.a + look.b + look.c;
        const colors = Array.from({ length: w }, (_, i) => g.cells[r * g.cols + Math.min(g.cols - 1, c + i)]?.color ?? yarn);
        cells[r * g.cols + c] = { ...look, colors };
        continue;
      }
      cells[r * g.cols + c] = look.k === "lean" ? { k: "lean", dir: look.dir, color } : look.k === "none" ? { k: "none" } : { k: look.k, color };
    }
  }
  return { chart: { cols: g.cols, rows: g.rows, cells }, approx: [...approx.values()] };
}
