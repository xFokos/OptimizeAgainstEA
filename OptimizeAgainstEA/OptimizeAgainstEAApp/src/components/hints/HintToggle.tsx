import { useHints } from './HintContext';

/**
 * Page-wide hints on/off switch. The choice persists across visits
 * (localStorage). "Reset" re-arms the one-time hints for the current session.
 */
export function HintToggle() {
  const { enabled, toggle, resetSeen } = useHints();

  return (
    <div className="hint-toggle">
      <button
        className={`btn btn--sm ${enabled ? 'btn--active' : 'btn--ghost'}`}
        onClick={toggle}
        title={enabled ? 'Hints are on — click to turn off' : 'Hints are off — click to turn on'}
      >
        💡 Hints: {enabled ? 'On' : 'Off'}
      </button>
      {enabled && (
        <button
          className="btn btn--sm btn--ghost"
          onClick={resetSeen}
          title="Show the one-time hints again"
        >
          ↻ Reset
        </button>
      )}
    </div>
  );
}
