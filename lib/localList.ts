"use client";

// A JSON array kept under one localStorage key, with a live React hook.
// Used by the local atelier, notifications and sent inquiries.
import { useSyncExternalStore } from "react";

export function createLocalList<T>(key: string, max = 500) {
  const listeners = new Set<() => void>();
  let cache: T[] | null = null;
  const EMPTY: T[] = [];

  const read = (): T[] => {
    if (cache) return cache;
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? "[]");
      cache = Array.isArray(v) ? (v as T[]) : [];
    } catch {
      cache = [];
    }
    return cache;
  };
  /** Replaces the list. Returns false when storage is full (the in-memory list still updates). */
  const write = (next: T[]): boolean => {
    cache = next.slice(0, max);
    listeners.forEach((l) => l());
    try {
      localStorage.setItem(key, JSON.stringify(cache));
      return true;
    } catch {
      return false;
    }
  };
  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) {
        cache = null;
        cb();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  };
  const useList = () => useSyncExternalStore(subscribe, read, () => EMPTY);
  return { key, read, write, subscribe, useList };
}
