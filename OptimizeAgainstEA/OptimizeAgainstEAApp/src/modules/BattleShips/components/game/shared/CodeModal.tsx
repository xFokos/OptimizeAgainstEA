import { useState } from 'react';

interface CodeModalProps {
  code: string;
  mapId: string;
  onClose: () => void;
  onPlayNow?: () => void;
}

export function CodeModal({ code, mapId, onClose, onPlayNow }: CodeModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <span className="modal__tag">MAP CREATED</span>
          <span className="modal__id">#{mapId}</span>
        </div>

        <p className="modal__desc">
          Share this code with another player so they can load your map.
        </p>

        <div className="modal__code-block">
          <code className="modal__code">{code}</code>
          <button className="modal__copy-btn" onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        <div className="modal__actions">
          {onPlayNow && (
            <button className="btn btn--primary" onClick={onPlayNow}>
              Play this map now
            </button>
          )}
          <button className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
