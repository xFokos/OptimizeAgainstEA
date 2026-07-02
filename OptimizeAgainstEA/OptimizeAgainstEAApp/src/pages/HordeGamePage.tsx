import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScaledCanvas } from '../hooks/useScaledCanvas';
import { useOrientationLock } from '../hooks/useOrientationLock';
import { ARENA } from '../modules/shooterGame/shooter.types';
import { HordeCanvas } from '../modules/shooterGame/components/HordeCanvas';
import { useInput } from '../modules/shooterGame/hooks/useInput';
import PageContainer from '../components/layout/PageContainer';

export default function HordeGamePage() {
    const navigate   = useNavigate();
    const inputRef   = useInput();
    useOrientationLock('landscape');

    const [vp, setVp] = useState(() => ({ W: window.innerWidth, H: window.innerHeight }));
    useEffect(() => {
        const h = () => setVp({ W: window.innerWidth, H: window.innerHeight });
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);

    const isMobileDevice    = Math.min(vp.W, vp.H) < 550;
    const isPortrait        = vp.H > vp.W;

    const { containerRef, scale } = useScaledCanvas({
        baseWidth:    ARENA.WIDTH,
        baseHeight:   ARENA.HEIGHT,
        sidebarWidth: 212,   // PANEL_W (200) + gap (12)
        padding:      16,
    });

    return (
        <PageContainer>
            {isMobileDevice && isPortrait && (
                <div style={{
                    position:       'fixed', inset: 0, zIndex: 9999,
                    background:     '#0f0f1a',
                    display:        'flex', flexDirection: 'column',
                    alignItems:     'center', justifyContent: 'center', gap: 16,
                }}>
                    <div style={{ fontSize: 48 }}>📱</div>
                    <p style={{ color: 'rgba(255,255,255,0.65)', fontFamily: '"JetBrains Mono", monospace', fontSize: 13, margin: 0 }}>
                        Please rotate device
                    </p>
                </div>
            )}

            <div
                ref={containerRef}
                style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
                <HordeCanvas scale={scale} externalInputRef={inputRef} />
            </div>

            <button
                onClick={() => navigate('/lobby/shooter', { state: { mode: 'horde' } })}
                style={{
                    position:      'fixed',
                    top:           10,
                    left:          10,
                    zIndex:        200,
                    background:    'rgba(15,15,26,0.85)',
                    border:        '1px solid rgba(255,255,255,0.18)',
                    borderRadius:  6,
                    color:         'rgba(255,255,255,0.6)',
                    fontFamily:    '"JetBrains Mono", monospace',
                    fontSize:      11,
                    padding:       '4px 12px',
                    cursor:        'pointer',
                    letterSpacing: '0.06em',
                }}
            >
                ← Lobby
            </button>
        </PageContainer>
    );
}
