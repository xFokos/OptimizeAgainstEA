/**
 * Clipboard helpers for map codes, with an in-app fallback.
 *
 * The system Clipboard API isn't available everywhere: `readText()` is blocked
 * for web pages in Firefox and disabled entirely on insecure origins (plain
 * http on a LAN IP). To keep Copy → Paste working across all browsers, every
 * Copy button records its value here (persisted in localStorage), and Paste
 * falls back to that value when the system clipboard can't be read.
 */

const KEY = 'bs.lastCopiedCode';

function remember(text: string): void {
  try { localStorage.setItem(KEY, text); } catch { /* storage unavailable */ }
}

function recall(): string {
  try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; }
}

/** Copy to the system clipboard when possible; always remember the value in-app. */
export async function copyCode(text: string): Promise<void> {
  remember(text);
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
}

/**
 * Resolve a code to paste: prefer the system clipboard, fall back to the last
 * value copied via {@link copyCode}. Returns a trimmed string ('' if neither
 * source has anything).
 */
export async function pasteCode(): Promise<string> {
  try {
    const text = await navigator.clipboard.readText();
    if (text && text.trim()) return text.trim();
  } catch { /* fall through to the in-app fallback */ }
  return recall().trim();
}
