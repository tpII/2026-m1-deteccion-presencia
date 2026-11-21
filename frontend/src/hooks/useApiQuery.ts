import { useCallback, useEffect, useRef, useState } from 'react';

export function useApiQuery<T>(
  load: (signal: AbortSignal) => Promise<T>,
  externalRevision = 0,
  keepDataOnRefresh = false,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const previousLoad = useRef(load);
  const refresh = useCallback(() => setRevision((previous) => previous + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    if (!keepDataOnRefresh || previousLoad.current !== load) setData(null);
    previousLoad.current = load;
    setLoading(true);
    setError(null);
    load(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : 'No se pudieron cargar los datos');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load, revision, externalRevision, keepDataOnRefresh]);

  return { data, loading, error, refresh };
}
