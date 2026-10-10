import { useCallback, useEffect, useState } from 'react';

/** Loads data when `deps` change; `reload` fetches again. Results of outdated requests are ignored. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({ data: null, error: '', loading: true });
  const [tick, setTick] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    run()
      .then((data) => live && setState({ data, error: '', loading: false }))
      .catch((e: Error) => live && setState((s) => ({ ...s, error: e.message, loading: false })));
    return () => {
      live = false;
    };
  }, [run, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload, setData: (data: T) => setState({ data, error: '', loading: false }) };
}
