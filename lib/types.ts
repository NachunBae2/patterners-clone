// Document model for every work ("도안") kept in the browser.

export type Craft = "crochet" | "knitting" | "grid";

export type View = { x: number; y: number; zoom: number };

// ---------- Crochet (whiteboard) ----------

export type StitchItem = {
  id: string;
  type: "stitch";
  symbol: string; // CrochetSymbol.id
  x: number; // world units (1 chain = 20 units wide)
  y: number;
  rotation: number; // degrees, 0 = upright
  flipH?: boolean;
  flipV?: boolean;
  scale?: number; // vertical stretch for tall stitches / chains (1 = default)
  color?: string;
  groupId?: string;
};

export type StrokeItem = {
  id: string;
  type: "stroke";
  points: [number, number][];
  closed?: boolean;
  color?: string;
  width?: number;
  dash?: "solid" | "dashed" | "dotted";
  groupId?: string;
};

export type TextItem = {
  id: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  size: number;
  color?: string;
  groupId?: string;
};

/** Increase / decrease made by gathering several stitches into one foot or head. */
export type GatherItem = {
  id: string;
  type: "gather";
  kind: "increase" | "decrease";
  symbol: string; // leg symbol
  count: number;
  x: number;
  y: number;
  rotation: number;
  spread: number; // degrees between legs
  color?: string;
  groupId?: string;
};

export type CrochetItem = StitchItem | StrokeItem | TextItem | GatherItem;

export type CrochetLayer = {
  id: string;
  name: string;
  visible: boolean;
  locked?: boolean;
  color?: string; // default colour for new stitches on this layer
  items: CrochetItem[];
  /** folder (CrochetFolder.id) this layer is listed under */
  folderId?: string;
  /** how a generated round / row was laid out, so the next one can follow it */
  guide?: RoundGuide;
};

/** Layer folder (폴더) in the layer list. Visibility is per layer; the folder toggles all of its layers. */
export type CrochetFolder = { id: string; name: string; collapsed?: boolean };

/** Layout of a generated round (offset of a core polygon around a centre) or row (horizontal line). */
export type RoundGuide =
  | { kind: "round"; layout: "radial" | "oval" | "square" | "hexagon"; cx: number; cy: number; core: [number, number][]; d: number; top: number; alpha?: number }
  | { kind: "row"; cx: number; foot: number; top: number; dir: 1 | -1 };

/** 기호 높이: chain-unit height per tall-stitch height class (2 = 긴뜨기 … 7 = 다섯길) and a global multiplier. */
export type StitchHeights = { scale?: number; units?: Record<string, number> };

export type CrochetData = {
  layers: CrochetLayer[];
  activeLayerId: string;
  quickSlots: (string | null)[]; // 5 symbol ids
  showGrid: boolean;
  view: View;
  /** layer folders (older charts have none) */
  folders?: CrochetFolder[];
  /** canvas background colour (default white) and opacity 0–100 */
  background?: string;
  backgroundOpacity?: number;
  /** tall-stitch heights (default: each stitch's own chain height) */
  heights?: StitchHeights;
};

// ---------- Knitting (grid boards with symbols + colour) ----------

export type KnitCell = { symbol?: string; color?: string } | null;

export type KnitGrid = {
  id: string;
  name: string;
  x: number; // board position in world units
  y: number;
  cols: number;
  rows: number;
  /** row-major, row 0 is the TOP row on screen (row number = rows - r). */
  cells: KnitCell[];
  visible: boolean;
};

export type KnitData = {
  grids: KnitGrid[];
  activeGridId: string | null;
  colors: string[]; // brush palette
  gauge: { sts: number; rows: number }; // per 10cm
  view: View;
};

// ---------- 배색·방안 (pixel colour chart) ----------

export type GridMode = "knit" | "tapestry" | "filet";

export type GridPage = {
  id: string;
  name: string;
  cols: number;
  rows: number;
  /** row-major palette indexes; -1 = empty (background). */
  cells: number[];
};

export type GridData = {
  mode: GridMode;
  yarns: string[]; // palette; index 0 is the background yarn
  pages: GridPage[];
  activePageId: string;
  gauge: { sts: number; rows: number };
};

export type WorkData = CrochetData | KnitData | GridData;

export type Work = {
  id: string;
  title: string;
  craft: Craft;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  deletedAt?: number | null;
  /** small SVG/PNG data URL rendered by the editor on save */
  thumbnail?: string;
  data: WorkData;
};

export const CRAFT_LABEL: Record<Craft, string> = {
  crochet: "코바늘",
  knitting: "대바늘",
  grid: "배색·방안",
};
