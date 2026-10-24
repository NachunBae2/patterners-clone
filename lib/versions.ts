"use client";

// Version history ("버전 기록") for one work, kept next to it in localStorage.
// Autosave records a version at most every AUTO_GAP; users can also save a named one.
import { useCallback, useSyncExternalStore } from "react";
import { uid } from "./id";
import type { WorkData } from "./types";

export type Version = {
  id: string;
  at: number;
  /** user-given name; auto versions have none */
  label?: string;
  auto: boolean;
  data: WorkData;
};

const key = (workId: string) => `pt:versions:${workId}`;
const AUTO_GAP = 5 * 60_000;
const MAX_AUTO = 40;
const MAX_NAMED = 40;

const listeners = new Set<() => void>();
const cache = new Map<string, Version[]>();
const baseline = new Map<string, { at: number; json: string }>();

function read(workId: string): Version[] {
  const hit = cache.get(workId);
  if (hit) return hit;
  let list: Version[] = [];
  try {
    const raw = localStorage.getItem(key(workId));
    list = raw ? (JSON.parse(raw) as Version[]) : [];
  } catch {
    list = [];
  }
  cache.set(workId, list);
  return list;
}

function write(workId: string, list: Version[]): boolean {
  cache.set(workId, list);
  listeners.forEach((l) => l());
  try {
    localStorage.setItem(key(workId), JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Newest first; drops the oldest auto versions (then named ones) beyond the caps. */
function trim(list: Version[]): Version[] {
  let auto = 0;
  let named = 0;
  return list.filter((v) => (v.auto ? ++auto <= MAX_AUTO : ++named <= MAX_NAMED));
}

export const versions = {
  list: (workId: string): Version[] => read(workId),
  get: (workId: string, id: string): Version | null => read(workId).find((v) => v.id === id) ?? null,
  /** Saves a named version now. Returns false when storage is full. */
  save(workId: string, data: WorkData, label?: string): boolean {
    const v: Version = { id: uid(), at: Date.now(), label: label?.trim() || undefined, auto: false, data: structuredClone(data) };
    return write(workId, trim([v, ...read(workId)]));
  },
  /**
   * Called by autosave: records a version when the last one is older than AUTO_GAP and the data changed.
   * With no versions yet, the first call only sets a baseline (opening a work autosaves once), so the
   * first auto version comes after AUTO_GAP of real edits.
   */
  autoSnapshot(workId: string, data: WorkData) {
    const list = read(workId);
    const last = list[0];
    if (!last) {
      const base = baseline.get(workId);
      const json = JSON.stringify(data);
      if (!base) return void baseline.set(workId, { at: Date.now(), json });
      if (Date.now() - base.at < AUTO_GAP || base.json === json) return;
    }
    if (last && Date.now() - last.at < AUTO_GAP) return;
    if (last && JSON.stringify(last.data) === JSON.stringify(data)) return;
    write(workId, trim([{ id: uid(), at: Date.now(), auto: true, data: structuredClone(data) }, ...list]));
  },
  rename: (workId: string, id: string, label: string) =>
    write(workId, read(workId).map((v) => (v.id === id ? { ...v, label: label.trim() || undefined, auto: false } : v))),
  remove: (workId: string, id: string) => write(workId, read(workId).filter((v) => v.id !== id)),
  clear(workId: string) {
    cache.delete(workId);
    try {
      localStorage.removeItem(key(workId));
    } catch {}
    listeners.forEach((l) => l());
  },
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
const EMPTY: Version[] = [];

/** Live version list for one work (newest first). Empty during SSR. */
export function useVersions(workId: string): Version[] {
  const get = useCallback(() => read(workId), [workId]);
  return useSyncExternalStore(subscribe, get, () => EMPTY);
}
