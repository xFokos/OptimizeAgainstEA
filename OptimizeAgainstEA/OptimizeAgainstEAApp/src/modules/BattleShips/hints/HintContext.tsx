import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { HintId } from './hintContent';
import { HINTS } from './hintContent';

// ── Persistence keys ──────────────────────────────────────────────────────
// enabled → localStorage: a player's on/off choice survives across visits.
// seen    → sessionStorage: one-time hints re-arm in a new browser session.
const ENABLED_KEY = 'bs.hints.enabled';
const SEEN_KEY = 'bs.hints.seen';

export interface HintAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'ghost';
}

export interface ActiveHint {
  id: HintId;
  title?: string;
  body: string;
  style: 'modal' | 'toast';
  pauses: boolean;
  sticky: boolean;
  actions: HintAction[];
}

interface ShowHintOptions {
  /** Fills {placeholders} in the hint body. */
  vars?: Record<string, string>;
  /** Contextual buttons (e.g. "Watch Replay"). Falls back to a "Got it" button. */
  actions?: HintAction[];
}

interface HintContextValue {
  enabled: boolean;
  active: ActiveHint | null;
  toggle: () => void;
  showHint: (id: HintId, opts?: ShowHintOptions) => void;
  dismiss: () => void;
  resetSeen: () => void;
  /** Whether a "once" hint has already been shown this session. */
  isSeen: (id: HintId) => boolean;
  /** Mark a hint as seen (persists to sessionStorage). */
  markSeen: (id: HintId) => void;
}

// ── Storage helpers (guarded — storage can throw in private mode) ──────────
const readEnabled = (): boolean => {
  try {
    return localStorage.getItem(ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
};

const readSeen = (): Set<string> => {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
};

export const fillTemplate = (body: string, vars?: Record<string, string>): string => {
  if (!vars) return body;
  return body.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? vars[key] : match,
  );
};

const HintContext = createContext<HintContextValue | null>(null);

export function HintsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean>(readEnabled);
  const [seen, setSeen] = useState<Set<string>>(readSeen);
  const [active, setActive] = useState<ActiveHint | null>(null);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem(ENABLED_KEY, String(next)); } catch { /* ignore */ }
      if (!next) setActive(null);
      return next;
    });
  }, []);

  const dismiss = useCallback(() => setActive(null), []);

  const resetSeen = useCallback(() => {
    try { sessionStorage.removeItem(SEEN_KEY); } catch { /* ignore */ }
    setSeen(new Set());
  }, []);

  const isSeen = useCallback((id: HintId) => seen.has(id), [seen]);

  const markSeen = useCallback((id: HintId) => {
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try { sessionStorage.setItem(SEEN_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const showHint = useCallback((id: HintId, opts?: ShowHintOptions) => {
    if (!enabled) return;
    const def = HINTS[id];
    if (!def) return;
    if (def.once && seen.has(id)) return;

    if (def.once) markSeen(id);

    setActive({
      id,
      title: def.title,
      body: fillTemplate(def.body, opts?.vars),
      style: def.style,
      pauses: def.pauses ?? false,
      sticky: def.sticky ?? false,
      actions: opts?.actions ?? [],
    });
  }, [enabled, seen, markSeen]);

  const value = useMemo<HintContextValue>(
    () => ({ enabled, active, toggle, showHint, dismiss, resetSeen, isSeen, markSeen }),
    [enabled, active, toggle, showHint, dismiss, resetSeen, isSeen, markSeen],
  );

  return <HintContext.Provider value={value}>{children}</HintContext.Provider>;
}

export function useHints(): HintContextValue {
  const ctx = useContext(HintContext);
  if (!ctx) throw new Error('useHints must be used within a HintsProvider');
  return ctx;
}
