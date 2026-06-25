import { useState } from 'react';
import { useSavedMaps } from '../../../hooks/useSavedMaps';
import { copyCode } from '../../../engine/codeClipboard';

const fmtDate = (ts: number): string =>
  new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * A left-edge drawer holding the player's own created maps. Hidden by default
 * behind a toggle button (mirrors the EA settings drawer, but anchored left).
 * Persists across sessions via useSavedMaps. Clicking a map copies its code to
 * the clipboard so the player can paste it into whichever field they want.
 */
export function SavedMapsSidebar() {
  const { savedMaps, removeMap, renameMap } = useSavedMaps();
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const copy = (id: string, code: string) => {
    void copyCode(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
  };

  const startRename = (id: string, current: string) => {
    setEditingId(id);
    setDraft(current);
  };

  const commitRename = () => {
    if (editingId) renameMap(editingId, draft);
    setEditingId(null);
  };

  return (
    <>
      <button
        className="saved-maps-toggle"
        onClick={() => setOpen(true)}
        title="Show your saved maps"
      >
        🗺 Your Maps{savedMaps.length > 0 ? ` (${savedMaps.length})` : ''}
      </button>

      {open && (
        <div
          className="saved-maps-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <aside className="saved-maps-panel" onClick={(e) => e.stopPropagation()}>
            <div className="saved-maps-panel__header">
              <span className="saved-maps-panel__title">Your Maps</span>
              <button
                className="saved-maps-panel__close"
                onClick={() => setOpen(false)}
                aria-label="Hide saved maps"
              >
                ✕
              </button>
            </div>

            <div className="saved-maps-panel__body">
              {savedMaps.length === 0 ? (
                <p className="saved-maps__empty">
                  Maps you create are saved here automatically.
                </p>
              ) : (
                <ul className="saved-maps__list">
                  {savedMaps.map((m) => (
                    <li key={m.id} className="saved-maps__item">
                      {editingId === m.id ? (
                        <input
                          className="saved-maps__rename-input"
                          value={draft}
                          autoFocus
                          spellCheck={false}
                          placeholder={`#${m.id}`}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                      ) : (
                        <button
                          className="saved-maps__use"
                          onClick={() => copy(m.id, m.code)}
                          title="Copy this map's code"
                        >
                          <span className="saved-maps__id">{m.name ?? `#${m.id}`}</span>
                          <span className="saved-maps__meta">
                            {copiedId === m.id
                              ? '✓ Code copied'
                              : `${m.minimaCount} minima · ${fmtDate(m.createdAt)}`}
                          </span>
                        </button>
                      )}
                      {confirmingId === m.id ? (
                        <>
                          <button
                            className="saved-maps__confirm"
                            onClick={() => { removeMap(m.id); setConfirmingId(null); }}
                            title="Confirm delete"
                          >
                            Delete?
                          </button>
                          <button
                            className="saved-maps__cancel"
                            onClick={() => setConfirmingId(null)}
                            aria-label="Cancel delete"
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="saved-maps__rename"
                            onClick={() => startRename(m.id, m.name ?? '')}
                            aria-label={`Rename map ${m.name ?? m.id}`}
                            title="Rename"
                          >
                            ✎
                          </button>
                          <button
                            className="saved-maps__del"
                            onClick={() => setConfirmingId(m.id)}
                            aria-label={`Delete map ${m.name ?? m.id}`}
                            title="Delete"
                          >
                            ×
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
