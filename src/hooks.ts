/* oxlint-disable react/set-state-in-effect -- These effects synchronize asynchronous API resources with loading, error and page state. */
import { useEffect, useState } from "react";
import { api, type Row } from "./api";
export function useData<T>(path: string | null, version = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState<Error | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    api<T>(path, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, version]);
  return { data, error, loading };
}
// Dropdowns fetch additional server pages only when requested, avoiding hidden 100-row limits.
export function useCatalog(path: string | null) {
  const [page, setPage] = useState(0),
    [attempt, setAttempt] = useState(0),
    [data, setData] = useState<Row[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<Error | null>(null),
    [hasMore, setHasMore] = useState(true);
  useEffect(() => {
    if (!path) {
      setData([]);
      setPage(0);
      setLoading(false);
      setError(null);
      setHasMore(true);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api<Row[]>(
      `${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${page * 100}`,
      { signal: controller.signal },
    )
      .then((batch) => {
        setData((previous) => (page === 0 ? batch : [...previous, ...batch]));
        setHasMore(batch.length === 100);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, page, attempt]);
  return {
    data,
    loading,
    error,
    hasMore,
    loadMore: () => (error ? setAttempt((a) => a + 1) : setPage((p) => p + 1)),
  };
}
