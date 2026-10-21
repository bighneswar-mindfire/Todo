import { useCallback, useEffect, useMemo, useRef } from "react";

export interface Debounced<A extends unknown[]> {
  run: (...args: A) => void;
  cancel: () => void;
}

/** `run` calls the latest `fn` once, `delay` ms after its last call. A pending call is dropped on unmount. */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay: number): Debounced<A> {
  const latest = useRef(fn);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    latest.current = fn;
  });

  const cancel = useCallback(() => clearTimeout(timer.current), []);
  const run = useCallback(
    (...args: A) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => latest.current(...args), delay);
    },
    [delay],
  );

  useEffect(() => cancel, [cancel]);

  return useMemo(() => ({ run, cancel }), [run, cancel]);
}
