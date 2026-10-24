"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { works } from "@/lib/store";
import { versions } from "@/lib/versions";
import type { WorkData } from "@/lib/types";

export type SaveStatus = "saved" | "saving" | "error";

/**
 * Debounced save to local storage (like lib/useAutosave), plus: can be switched off (lesson practice docs),
 * flushes pending changes when the editor unmounts, and reports the last save time.
 */
export function useKnitAutosave(id: string, data: WorkData, opts: { enabled: boolean; thumb?: () => string | undefined; initialSavedAt: number | null; delay?: number }) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [savedAt, setSavedAt] = useState<number | null>(opts.initialSavedAt);
  const first = useRef(true);
  const pending = useRef(false);
  const latest = useRef(data);
  latest.current = data;
  const thumbRef = useRef(opts.thumb);
  thumbRef.current = opts.thumb;
  const enabled = opts.enabled;
  const delay = opts.delay ?? 600;

  const flush = useCallback(() => {
    if (!enabled) return true;
    let thumbnail: string | undefined;
    try {
      thumbnail = thumbRef.current?.();
    } catch {
      thumbnail = undefined;
    }
    const ok = works.save(id, latest.current, thumbnail ? { thumbnail } : {});
    pending.current = false;
    setStatus(ok ? "saved" : "error");
    if (ok) {
      setSavedAt(Date.now());
      versions.autoSnapshot(id, latest.current);
    }
    return ok;
  }, [enabled, id]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!enabled) return;
    pending.current = true;
    setStatus("saving");
    const t = setTimeout(flush, delay);
    return () => clearTimeout(t);
  }, [data, delay, enabled, flush]);

  useEffect(() => {
    if (!enabled) return;
    const onUnload = () => pending.current && works.save(id, latest.current);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      // leaving the editor (e.g. into a lesson): keep what was typed in the last debounce window
      if (pending.current) works.save(id, latest.current);
    };
  }, [enabled, id]);

  return { status, savedAt, retry: flush };
}
