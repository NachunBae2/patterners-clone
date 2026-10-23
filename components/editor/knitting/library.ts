// Stitch-pattern library (무늬 라이브러리). Rows are listed top → bottom as on the chart.
// Tokens are symbol ids; "-" is a cell covered by the wide symbol to its left.
import type { KnitCell } from "@/lib/types";
import type { Block } from "./model";

export type LibCat = "basic" | "rib" | "texture" | "lace" | "cable";
export const LIB_CATS: { id: LibCat; label: string }[] = [
  { id: "basic", label: "기본" },
  { id: "rib", label: "고무단" },
  { id: "texture", label: "질감" },
  { id: "lace", label: "레이스" },
  { id: "cable", label: "교차" },
];

export type LibPattern = { id: string; name: string; cat: LibCat; block: Block };

const P = (id: string, name: string, cat: LibCat, rows: string[]): LibPattern => {
  const grid = rows.map((r) => r.trim().split(/\s+/));
  const cols = grid[0].length;
  const cells: KnitCell[] = [];
  for (const row of grid) {
    if (row.length !== cols) throw new Error(`pattern ${id}: ragged row`);
    for (const t of row) cells.push(t === "-" ? null : { symbol: t });
  }
  return { id, name, cat, block: { cols, rows: grid.length, cells } };
};
const rep = (row: string, n: number) => Array(n).fill(row) as string[];

export const KNIT_LIBRARY: LibPattern[] = [
  P("stockinette", "메리야스뜨기", "basic", ["k"]),
  P("reverse_stockinette", "안메리야스뜨기", "basic", ["p"]),
  P("garter", "가터뜨기", "basic", ["p", "k"]),
  P("welt", "가로 골무늬", "basic", ["p", "p", "k", "k"]),

  P("rib_1x1", "1×1 고무단", "rib", ["p k"]),
  P("rib_2x2", "2×2 고무단", "rib", ["p p k k"]),
  P("rib_2x1", "2×1 고무단", "rib", ["p k k"]),
  P("twisted_rib", "꼬아뜨기 고무단", "rib", ["p ktbl"]),
  P("broken_rib", "끊어진 고무단", "rib", ["p k", "k k"]),

  P("seed", "멍석뜨기", "texture", ["k p", "p k"]),
  P("moss", "이중 멍석뜨기", "texture", ["k p", "k p", "p k", "p k"]),
  P("check_2x2", "바둑판 2×2", "texture", ["k k p p", "k k p p", "p p k k", "p p k k"]),
  P("check_4x4", "바둑판 4×4", "texture", [...rep("k k k k p p p p", 4), ...rep("p p p p k k k k", 4)]),
  P("basketweave", "바구니 무늬", "texture", [
    ...rep("k k k k p p p p", 3),
    "k k k k k k k k",
    ...rep("p p p p k k k k", 3),
    "k k k k k k k k",
  ]),
  P("diagonal", "사선 무늬", "texture", ["p k k k", "k p k k", "k k p k", "k k k p"]),
  P("dots", "점 무늬", "texture", ["k k k k", "k p k k", "k k k k", "k k k p"]),
  P("bobbles", "방울 무늬", "texture", ["k k k k", "k bob k k", "k k k k", "k k k bob"]),

  P("eyelet_rows", "구멍 줄무늬", "lace", ["k k", "yo k2tog", "k k", "k k"]),
  P("mesh", "그물 레이스", "lace", ["yo k2tog", "k k"]),
  P("chevron_lace", "V자 레이스", "lace", ["k yo ssk k k2tog yo", "k k k k k k"]),

  P("cable_2x2", "2/2 교차 (왼코 위)", "cable", [
    "p p c2l - - - p p",
    ...rep("p p k k k k p p", 5),
  ]),
  P("cable_2x2_right", "2/2 교차 (오른코 위)", "cable", [
    "p p c2r - - - p p",
    ...rep("p p k k k k p p", 5),
  ]),
  P("cable_3x3", "3/3 교차 (왼코 위)", "cable", [
    "p p c3l - - - - - p p",
    ...rep("p p k k k k k k p p", 7),
  ]),
  P("rope_1x1", "1/1 교차 줄", "cable", ["p c1l - p", "p k k p"]),
];
