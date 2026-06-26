import { useState } from 'react';
import type { MapConfig } from '../../../types/map.ts';
import { decodeMap, encodeMap, generateRandomMap } from '../../../engine/mapCodec';
import { copyCode, pasteCode } from '../../../engine/codeClipboard';
import { SavedMapsSidebar } from '../shared/SavedMapsSidebar';

interface MapLoaderProps {
  onLoad: (config: MapConfig) => void;
  onBack: () => void;
}

export function MapLoader({ onLoad, onBack }: MapLoaderProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handlePlay = () => {
    try {
      const config = decodeMap(code.trim());
      onLoad(config);
    } catch {
      setError('Invalid code — double-check and try again.');
    }
  };

  // Generate a random map, drop its code into the field, and copy it to the
  // clipboard so the player can share it. They press Play to start.
  const handleRandom = () => {
    const numMinima = 4 + Math.floor(Math.random() * 5); // 4–8
    const newCode = encodeMap(generateRandomMap(numMinima));
    setCode(newCode);
    setError('');
    void copyCode(newCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClipboardPaste = async () => {
    const text = await pasteCode();
    if (text) { setCode(text); setError(''); }
    else setError('Nothing to paste — copy a code first, or paste it manually.');
  };

  return (
    <div className="loader-with-saved">
    <SavedMapsSidebar />
    <div className="map-loader">
      <h2 className="map-loader__heading">Load a Map</h2>
      <p className="map-loader__desc">
        Generate a random map, or paste a code from a friend, then press Play.
      </p>

      <button className="btn btn--ghost map-loader__random" onClick={handleRandom}>
        🎲 Generate Random Map
      </button>
      {copied && <p className="map-loader__copied">✓ Code copied to clipboard</p>}

      <div className="map-loader__input-row">
        <input
          className="map-loader__input"
          placeholder="Paste map code…"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handlePlay()}
          spellCheck={false}
        />
        <button
          className="btn btn--ghost"
          onClick={handleClipboardPaste}
          title="Paste from clipboard"
        >
          📋 Paste
        </button>
      </div>

      {error && <p className="map-loader__error">{error}</p>}

      <button
        className="btn btn--primary map-loader__play"
        disabled={!code.trim()}
        onClick={handlePlay}
      >
        ▶ Play
      </button>

      <button className="btn btn--ghost btn--sm" onClick={onBack} style={{ marginTop: 8 }}>
        ← Back
      </button>
    </div>
    </div>
  );
}
