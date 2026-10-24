"use client";

// Remembers which work a share link or atelier entry was already copied into,
// so pressing "복제"/"가져오기" again opens that copy instead of making another one.
import { works } from "./store";

const KEY = "pt:clones";

function read(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/** Short stable key for a long source string (e.g. a share hash). */
export function sourceKey(prefix: string, source: string) {
  let h = 5381;
  for (let i = 0; i < source.length; i++) h = ((h << 5) + h + source.charCodeAt(i)) | 0;
  return `${prefix}:${(h >>> 0).toString(36)}:${source.length}`;
}

export const clones = {
  /** The copy made earlier from this source, if it still exists and isn't in the trash. */
  get(key: string): string | null {
    const id = read()[key];
    if (!id) return null;
    const w = works.list().find((x) => x.id === id);
    return w && !w.deletedAt ? id : null;
  },
  set(key: string, workId: string) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...read(), [key]: workId }));
    } catch {}
  },
};
