// Document model for every work ("도안") kept in the browser.

export type Craft = "crochet" | "knitting" | "grid" | "apparel" | "paper";

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
};

export type CrochetData = {
  layers: CrochetLayer[];
  activeLayerId: string;
  quickSlots: (string | null)[]; // 5 symbol ids
  showGrid: boolean;
  view: View;
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

// ---------- 의류 도안 (garment pattern from measurements) ----------

export type ApparelStyle = "setIn" | "dropShoulder" | "vest" | "raglan";
export type ApparelFit = "slim" | "regular" | "over";
export type ApparelSize = "S" | "M" | "L" | "XL";
export type ApparelPiece = "back" | "front" | "sleeve";

/** Body measurements in cm (before ease). */
export type ApparelMeasure = {
  bust: number;
  bodyLength: number;
  shoulderWidth: number;
  armholeDepth: number;
  sleeveLength: number;
  upperArm: number;
  cuffWidth: number;
  neckWidth: number;
  frontNeckDepth: number;
  backNeckDepth: number;
  shoulderDrop: number;
  hemRib: number;
  cuffRib: number;
};

export type ApparelData = {
  style: ApparelStyle;
  cardigan: boolean;
  neckline: "round" | "v";
  craft: "knit" | "crochet";
  size: ApparelSize;
  fit: ApparelFit;
  measure: ApparelMeasure;
  /** cm added to the body measurement */
  ease: { bust: number; armhole: number; upperArm: number };
  gauge: { sts: number; rows: number }; // per 10cm
  bandWidth: number; // cardigan front band, cm
  buttons: number;
  showDims: boolean;
  /** another work's thumbnail laid over a piece */
  overlay?: { workId: string; piece: ApparelPiece; x: number; y: number; scale: number; opacity: number } | null;
};

// ---------- 페이퍼 (pattern write-up document) ----------

export type PaperBorder = { style: "solid" | "dashed" | "dotted" | "double" | "none"; width: number; color: string };

export type PaperBlock =
  | { id: string; type: "heading"; level: 1 | 2 | 3; text: string; align?: "left" | "center" | "right" }
  | { id: string; type: "paragraph"; text: string; align?: "left" | "center" | "right" }
  | { id: string; type: "list"; ordered: boolean; items: string[] }
  | {
      id: string;
      type: "table";
      header: boolean;
      rows: string[][];
      preset: "basic" | "outerBold" | "rowsOnly" | "header" | "none";
      border: PaperBorder;
    }
  | { id: string; type: "image"; src: string; caption: string; width: number; name?: string }
  | { id: string; type: "divider" }
  | { id: string; type: "embed"; workId: string; caption: string; width: number };

export type PaperData = {
  blocks: PaperBlock[];
  /** show the document title at the top of the page */
  showTitle: boolean;
};

export type WorkData = CrochetData | KnitData | GridData | ApparelData | PaperData;

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
  apparel: "의류",
  paper: "페이퍼",
};
