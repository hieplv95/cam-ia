import { useCallback, useRef, useState } from 'react';

import type { Doc } from './types';

const MAX_HISTORY = 30;
/** Full-resolution originals are large; only the most recent undo steps keep their own. */
const KEEP_FULL_STEPS = 3;

function trimFull(past: Doc[], present: Doc | null) {
  const cut = past.length - KEEP_FULL_STEPS;
  return past.map((d, i) => (i < cut && d.full && d.full !== present?.full ? { ...d, full: undefined } : d));
}
/** Gestures that start together (pan + pinch + rotate) share a single undo step. */
const MERGE_WINDOW_MS = 400;

export function useDocHistory(initial: Doc | null) {
  const [state, setState] = useState<{ past: Doc[]; present: Doc | null; future: Doc[] }>({
    past: [],
    present: initial,
    future: [],
  });
  const lastCheckpoint = useRef(0);

  /** Records the current doc as an undo step. Call before a change starts. */
  const checkpoint = useCallback(() => {
    const now = Date.now();
    if (now - lastCheckpoint.current < MERGE_WINDOW_MS) return;
    lastCheckpoint.current = now;
    setState((s) =>
      s.present ? { past: trimFull([...s.past, s.present].slice(-MAX_HISTORY), s.present), present: s.present, future: [] } : s,
    );
  }, []);

  /** Mutates the current doc without creating an undo step. */
  const update = useCallback((fn: (doc: Doc) => Doc) => {
    setState((s) => (s.present ? { ...s, present: fn(s.present) } : s));
  }, []);

  /** Replaces the doc as one undoable step. */
  const commit = useCallback((doc: Doc) => {
    lastCheckpoint.current = 0;
    setState((s) => ({
      past: trimFull(s.present ? [...s.past, s.present].slice(-MAX_HISTORY) : s.past, doc),
      present: doc,
      future: [],
    }));
  }, []);

  const undo = useCallback(() => {
    setState((s) =>
      s.past.length && s.present
        ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] }
        : s,
    );
  }, []);

  const redo = useCallback(() => {
    setState((s) =>
      s.future.length && s.present
        ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) }
        : s,
    );
  }, []);

  /** Jumps to any earlier or later state; everything stays reachable with undo/redo. */
  const jumpTo = useCallback((index: number) => {
    setState((s) => {
      const timeline = s.present ? [...s.past, s.present, ...s.future] : [...s.past, ...s.future];
      if (index < 0 || index >= timeline.length) return s;
      return { past: timeline.slice(0, index), present: timeline[index], future: timeline.slice(index + 1) };
    });
  }, []);

  return {
    doc: state.present,
    /** Every state from the first to the last, and where the current one is. */
    timeline: state.present ? [...state.past, state.present, ...state.future] : [],
    position: state.past.length,
    jumpTo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    checkpoint,
    update,
    commit,
    undo,
    redo,
  };
}
