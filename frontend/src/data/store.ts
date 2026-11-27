// A list kept in this browser. Stands in for the API until it exists.
import { useSyncExternalStore } from "react";

export function createStore<T>(key: string, seed: T[]) {
  const listeners = new Set<() => void>();
  let cache: T[] | null = null;

  function read(): T[] {
    if (!cache) {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
        cache = Array.isArray(saved) ? (saved as T[]) : seed;
      } catch {
        cache = seed;
      }
    }
    return cache;
  }

  /** Throws when the browser refuses to store it, leaving data unchanged. */
  function write(next: T[]) {
    localStorage.setItem(key, JSON.stringify(next));
    cache = next;
    listeners.forEach((notify) => notify());
  }

  function subscribe(notify: () => void) {
    // another tab changed the data
    const onStorage = () => {
      cache = null;
      notify();
    };
    listeners.add(notify);
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(notify);
      window.removeEventListener("storage", onStorage);
    };
  }

  /** Drops the cached copy so the next read sees what other tabs saved. */
  const refresh = () => {
    cache = null;
    return read();
  };

  const useList = () => useSyncExternalStore(subscribe, read, () => seed);

  return { read, write, refresh, useList };
}
