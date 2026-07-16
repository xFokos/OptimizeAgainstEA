/**
 * Shared observer plumbing for the module-level singleton stores (gameStore,
 * analyticsStore, hordeGameStore, …). Spread the result into a store object
 * literal; domain methods on the store mutate their fields and call
 * `this.notify()`. Components subscribe directly or via `useSyncExternalStore`:
 *
 *     export const fooStore = {
 *       value: 0,
 *       ...createListenable(),
 *       bump() { this.value++; this.notify(); },
 *     };
 */
export interface Listenable {
  /** Invoke every subscribed listener. */
  notify(): void;
  /** Register a listener; returns the matching unsubscribe function. */
  subscribe(fn: () => void): () => void;
}

export function createListenable(): Listenable {
  const listeners = new Set<() => void>();
  return {
    notify() {
      listeners.forEach(fn => fn());
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  };
}
