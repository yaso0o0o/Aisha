"use client";

import { useCallback, useEffect, useState } from "react";

/** A dashboard list loaded from the API, with a reload and a local replace after saving. */
export function useServerList<T>(load: () => Promise<T[]>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    try {
      setItems(await load());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load from the API
    reload();
  }, [reload]);

  return { items, setItems, failed, reload };
}
