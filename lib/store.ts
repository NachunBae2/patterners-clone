"use client";

// Works live in localStorage. One key per work + an index for listing.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { uid } from "./id";
import { versions } from "./versions";
import type { Craft, CrochetData, GridData, KnitData, Work, WorkData } from "./types";

const INDEX_KEY = "pt:works";
const workKey = (id: string) => `pt:work:${id}`;
const TRASH_DAYS = 30;

type IndexEntry = Omit<Work, "data">;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

let indexCache: IndexEntry[] | null = null;
function readIndex(): IndexEntry[] {
  if (indexCache) return indexCache;
  const now = Date.now();
  const all = read<IndexEntry[]>(INDEX_KEY, []);
  // purge works that have been in the trash for more than 30 days
  const keep = all.filter((w) => !w.deletedAt || now - w.deletedAt < TRASH_DAYS * 864e5);
  if (keep.length !== all.length) {
    all.filter((w) => !keep.includes(w)).forEach((w) => {
      localStorage.removeItem(workKey(w.id));
      versions.clear(w.id);
    });
    write(INDEX_KEY, keep);
  }
  indexCache = keep;
  return keep;
}
function writeIndex(next: IndexEntry[]) {
  indexCache = next;
  write(INDEX_KEY, next);
  emit();
}

const meta = (w: Work): IndexEntry => {
  const { data: _data, ...rest } = w;
  return rest;
};

// ---------- defaults ----------

export function emptyData(craft: Craft): WorkData {
  if (craft === "crochet") {
    // Reference defaults: no layers until the first stitch; slots sc, dc, ch, hdc, slst.
    const d: CrochetData = {
      layers: [],
      activeLayerId: "",
      quickSlots: ["sc", "dc", "ch", "hdc", "slst"],
      showGrid: true,
      view: { x: 0, y: 0, zoom: 1 },
    };
    return d;
  }
  if (craft === "knitting") {
    const d: KnitData = {
      grids: [],
      activeGridId: null,
      colors: ["#24365c", "#efe7d6", "#c47a5c", "#6d9c1c", "#5d8aa1", "#f2c94c"],
      gauge: { sts: 22, rows: 30 },
      view: { x: 0, y: 0, zoom: 1 },
    };
    return d;
  }
  const pageId = uid();
  const cols = 40;
  const rows = 30;
  const d: GridData = {
    mode: "knit",
    yarns: ["#f4f1ea", "#2b2b2b"],
    pages: [{ id: pageId, name: "페이지 1", cols, rows, cells: Array(cols * rows).fill(-1) }],
    activePageId: pageId,
    gauge: { sts: 20, rows: 22 },
  };
  return d;
}

const NEW_TITLE: Record<Craft, string> = {
  crochet: "새 코바늘 도안",
  knitting: "새 대바늘 도안",
  grid: "새 배색·방안 도안",
};

// ---------- API ----------

export const works = {
  list: (): IndexEntry[] => readIndex(),
  get: (id: string): Work | null => {
    const m = readIndex().find((w) => w.id === id);
    if (!m) return null;
    const data = read<WorkData | null>(workKey(id), null);
    return data ? { ...m, data } : null;
  },
  create(craft: Craft, title?: string, data?: WorkData): Work {
    const now = Date.now();
    const w: Work = { id: uid(), title: title ?? NEW_TITLE[craft], craft, createdAt: now, updatedAt: now, data: data ?? emptyData(craft) };
    write(workKey(w.id), w.data);
    writeIndex([meta(w), ...readIndex()]);
    return w;
  },
  /** Saves data (and optional meta). Returns false when storage is full. */
  save(id: string, data: WorkData, patch: Partial<IndexEntry> = {}): boolean {
    const ok = write(workKey(id), data);
    writeIndex(readIndex().map((w) => (w.id === id ? { ...w, ...patch, updatedAt: Date.now() } : w)));
    return ok;
  },
  update(id: string, patch: Partial<IndexEntry>) {
    writeIndex(readIndex().map((w) => (w.id === id ? { ...w, ...patch } : w)));
  },
  duplicate(id: string): Work | null {
    const w = works.get(id);
    if (!w) return null;
    return works.create(w.craft, `${w.title} (사본)`, structuredClone(w.data));
  },
  trash: (id: string) => works.update(id, { deletedAt: Date.now(), pinned: false }),
  restore: (id: string) => works.update(id, { deletedAt: null }),
  destroy(id: string) {
    localStorage.removeItem(workKey(id));
    versions.clear(id);
    writeIndex(readIndex().filter((w) => w.id !== id));
  },
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === INDEX_KEY) {
      indexCache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}
const EMPTY: IndexEntry[] = [];

/** Live list of works (metadata only). Empty during SSR. */
export function useWorkList(): IndexEntry[] {
  return useSyncExternalStore(subscribe, readIndex, () => EMPTY);
}

/** Loads one work on the client. `undefined` while loading, `null` when missing. */
export function useWork(id: string) {
  const [work, setWork] = useState<Work | null | undefined>(undefined);
  useEffect(() => setWork(works.get(id)), [id]);
  const save = useCallback((data: WorkData, patch?: Partial<IndexEntry>) => works.save(id, data, patch), [id]);
  return { work, save };
}
