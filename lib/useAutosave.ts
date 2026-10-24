"use client";

import { useEffect, useRef, useState } from "react";
import { works } from "./store";
import { versions } from "./versions";
import type { WorkData } from "./types";

export type SaveStatus = "saved" | "saving" | "error";

/**
 * Debounced save of an editor's document to local storage.
 * `thumb` is computed lazily at save time (it can be expensive).
 */
export function useAutosave(id: string, data: WorkData, thumb?: () => string | undefined, delay = 600) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const first = useRef(true);
  const thumbRef = useRef(thumb);
  thumbRef.current = thumb;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus("saving");
    const t = setTimeout(() => {
      let thumbnail: string | undefined;
      try {
        thumbnail = thumbRef.current?.();
      } catch {
        thumbnail = undefined;
      }
      const ok = works.save(id, data, thumbnail ? { thumbnail } : {});
      if (ok) versions.autoSnapshot(id, data);
      setStatus(ok ? "saved" : "error");
    }, delay);
    return () => clearTimeout(t);
  }, [id, data, delay]);

  // flush on tab close
  useEffect(() => {
    const flush = () => works.save(id, data);
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [id, data]);

  return status;
}
