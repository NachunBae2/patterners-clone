"use client";

// "내 기호": reusable components saved from a selection, shared by every crochet work in this browser.
import { useSyncExternalStore } from "react";
import { uid } from "@/lib/id";
import type { CrochetItem } from "@/lib/types";
import { boxCenter, cloneItems, unionBounds } from "./geometry";

export type MyIcon = { id: string; name: string; items: CrochetItem[]; createdAt: number };

const KEY = "pt:crochet:myIcons";
export const MY_ICON_MAX = 60;

let cache: MyIcon[] | null = null;
const listeners = new Set<() => void>();

function read(): MyIcon[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as MyIcon[]) : [];
    cache = Array.isArray(v) ? v.filter((x) => x && Array.isArray(x.items)) : [];
  } catch {
    cache = [];
  }
  return cache;
}
function write(next: MyIcon[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full: keep in memory */
  }
  listeners.forEach((l) => l());
}

export const myIcons = {
  list: read,
  get: (id: string) => read().find((m) => m.id === id) ?? null,
  /** Saves items normalised around their bounding-box centre. */
  add(name: string, items: CrochetItem[]): MyIcon | null {
    const b = unionBounds(items);
    if (!b) return null;
    const c = boxCenter(b);
    const icon: MyIcon = { id: uid(), name, items: cloneItems(items, -c.x, -c.y), createdAt: Date.now() };
    write([icon, ...read()].slice(0, MY_ICON_MAX));
    return icon;
  },
  rename: (id: string, name: string) => write(read().map((m) => (m.id === id ? { ...m, name } : m))),
  remove: (id: string) => write(read().filter((m) => m.id !== id)),
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}
const EMPTY: MyIcon[] = [];
export function useMyIcons(): MyIcon[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
