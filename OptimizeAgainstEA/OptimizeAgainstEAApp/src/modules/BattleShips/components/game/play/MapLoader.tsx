import { useState } from 'react';
import type { MapConfig } from '../../../types/map.ts';
import { decodeMap, generateRandomMap } from '../../../engine/mapCodec';
import { SavedMapsSidebar } from '../shared/SavedMapsSidebar';

interface MapLoaderProps {
  onLoad: (config: MapConfig) => void;
  onBack: () => void;
}

export function MapLoader({ onLoad, onBack }: MapLoaderProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handlePaste = () => {
    try {
      const config = decodeMap(code.trim());
      onLoad(config);
    } catch {
      setError('Invalid code — double-check and try again.');
    }
  };

  const handleRandom = () => {
    const numMinima = 4 + Math.floor(Math.random() * 5); // 4–8
    onLoad(generateRandomMap(numMinima));
  };

  return (
    <div className="loader-with-saved">
    <SavedMapsSidebar />
    <div className="map-loader">
      <h2 className="map-loader__heading">Load a Map</h2>
      <p className="map-loader__desc">
        Paste a code from a friend, or generate a random map to start exploring.
      </p>

      <div className="map-loader__input-row">
        <input
          className="map-loader__input"
          placeholder="Paste map code…"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handlePaste()}
          spellCheck={false}
        />
        <button
          className="btn btn--primary"
          disabled={!code.trim()}
          onClick={handlePaste}
        >
          Load
        </button>
      </div>

      {error && <p className="map-loader__error">{error}</p>}

      <div className="map-loader__divider"><span>or</span></div>

      <button className="btn btn--ghost map-loader__random" onClick={handleRandom}>
        Generate Random Map
      </button>

      <button className="btn btn--ghost btn--sm" onClick={onBack} style={{ marginTop: 8 }}>
        ← Back
      </button>
    </div>
    </div>
  );
}
