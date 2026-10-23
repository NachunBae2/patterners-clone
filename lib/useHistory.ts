"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Immutable document state with undo/redo.
 * - `set(next)` records an undo step.
 * - `checkpoint()` then `set(next, { merge: true })` folds a whole drag into one step.
 * - `replace(next)` changes state without touching history.
 * History lives in refs (not inside state updaters) so StrictMode double-calls are safe.
 */
export function useHistory<T>(initial: T, limit = 200) {
  const cur = useRef(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [, render] = useState(0);
  const rerender = () => render((n) => n + 1);

  const push = (value: T) => {
    past.current.push(value);
    if (past.current.length > limit) past.current.shift();
  };

  const set = useCallback((next: T | ((prev: T) => T), opts: { merge?: boolean } = {}) => {
    const prev = cur.current;
    const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
    if (Object.is(value, prev)) return;
    if (!opts.merge) push(prev);
    future.current = [];
    cur.current = value;
    rerender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkpoint = useCallback(() => {
    push(cur.current);
    future.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const undo = useCallback(() => {
    const p = past.current.pop();
    if (p === undefined) return;
    future.current.push(cur.current);
    cur.current = p;
    rerender();
  }, []);

  const redo = useCallback(() => {
    const f = future.current.pop();
    if (f === undefined) return;
    push(cur.current);
    cur.current = f;
    rerender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const replace = useCallback((next: T | ((prev: T) => T)) => {
    const prev = cur.current;
    const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
    if (Object.is(value, prev)) return;
    cur.current = value;
    rerender();
  }, []);

  /** Reset to a fresh document (clears history). */
  const reset = useCallback((value: T) => {
    past.current = [];
    future.current = [];
    cur.current = value;
    rerender();
  }, []);

  return {
    state: cur.current,
    get: () => cur.current,
    set,
    replace,
    checkpoint,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
