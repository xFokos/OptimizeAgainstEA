import type { CSSProperties } from 'react';

/** Shared inline-style tokens for the maze game UI slice. */

export const btn: CSSProperties = {
  background: 'rgba(255,255,255,0.08)', color: '#e8eaf0', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 14,
};

export const panel: CSSProperties = {
  background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 14,
};

export const lbl: CSSProperties = { display: 'block', fontSize: 12, opacity: 0.7, marginBottom: 6 };

export const select: CSSProperties = {
  width: '100%', background: '#15171f', color: '#e8eaf0', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6, padding: '8px 10px', fontSize: 14,
};

export const settingRow: CSSProperties = { marginBottom: 12 };

export const settingHeader: CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  fontSize: 12, marginBottom: 4,
};

export const settingValue: CSSProperties = {
  fontFamily: 'monospace', fontSize: 12, color: '#4af0a0',
};

export const slider: CSSProperties = { width: '100%', accentColor: '#4af0a0' };

export const divider: CSSProperties = {
  fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'rgba(232,234,240,0.5)', margin: '16px 0 8px', borderTop: '1px solid rgba(255,255,255,0.08)',
  paddingTop: 10,
};
