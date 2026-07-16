import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useScaledCanvas } from '../hooks/useScaledCanvas';
import { useOrientationLock } from '../hooks/useOrientationLock';
import { useViewport } from '../hooks/useViewport';
import { ARENA } from '../modules/shooterGame/shooter.types';
import { HordeCanvas } from '../modules/shooterGame/components/HordeCanvas';
import { hordeGameStore } from '../modules/shooterGame/horde/hordeGameStore';
import { MobileJoystickZone } from '../modules/shooterGame/components/MobileJoystickZone';
import { MobileAimZone } from '../modules/shooterGame/components/MobileAimZone';
import { useInput } from '../modules/shooterGame/hooks/useInput';
import PageContainer from '../components/layout/PageContainer';
import { HintsProvider, HintLayer } from '../components/hints';

const supportsFullscreen =
    typeof document !== 'undefined' && 'requestFullscreen' in document.documentElement;

// Orientation-lock on Android Chrome only actually engages while in fullscreen —
// same reasoning as ShooterGamePage's identical hook.
function useFullscreen() {
    const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

    useEffect(() => {
        const onChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    const toggle = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        }
    };

    return { isFullscreen, toggle };
}

const TOUCH_ZONE_WIDTH = 130;

export default function HordeGamePage() {
    return (
        <HintsProvider>
            <HordeGameContent />
            <HintLayer />
        </HintsProvider>
    );
}

function HordeGameContent() {
    const navigate   = useNavigate();
    const location   = useLocation();
    const tutorial   = !!(location.state as { tutorial?: boolean } | null)?.tutorial;
    const inputRef   = useInput();
    useOrientationLock('landscape');
    const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

    const { W, H } = useViewport();
    const isMobileDevice    = Math.min(W, H) < 550;
    const isPortrait        = H > W;
    const isMobileLandscape = isMobileDevice && !isPortrait;

    const { containerRef, scale } = useScaledCanvas({
        baseWidth:    ARENA.WIDTH,
        baseHeight:   ARENA.HEIGHT,
        sidebarWidth: isMobileLandscape ? 0 : 212,   // PANEL_W (200) + gap (12) — DNA panel is hidden on mobile
        padding:      isMobileLandscape ? 4 : 16,
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

            <div style={{ width: '100%', height: '100%', display: 'flex' }}>
                {isMobileLandscape && (
                    <div style={{ width: TOUCH_ZONE_WIDTH, flexShrink: 0 }}>
                        <MobileJoystickZone inputRef={inputRef} />
                    </div>
                )}

                <div
                    ref={containerRef}
                    style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <HordeCanvas scale={scale} externalInputRef={inputRef} touchControls={isMobileLandscape} tutorial={tutorial} />
                </div>

                {isMobileLandscape && (
                    <div style={{ width: TOUCH_ZONE_WIDTH, flexShrink: 0 }}>
                        <MobileAimZone inputRef={inputRef} />
                    </div>
                )}
            </div>

            <button
                onClick={async () => {
                    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
                    if (tutorial) {
                        hordeGameStore.state = null;
                        hordeGameStore.notify();
                    }
                    navigate('/lobby/shooter', { state: { mode: 'horde' } });
                }}
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
                    touchAction:   'manipulation',
                    userSelect:    'none',
                }}
            >
                ← Lobby
            </button>

            {isMobileLandscape && supportsFullscreen && (
                <button
                    onClick={toggleFullscreen}
                    style={{
                        position:      'fixed',
                        top:           6,
                        left:          '50%',
                        transform:     'translateX(-50%)',
                        zIndex:        200,
                        background:    isFullscreen
                            ? 'rgba(255,255,255,0.12)'
                            : 'rgba(15,15,26,0.85)',
                        border:        '1px solid rgba(255,255,255,0.18)',
                        borderRadius:  6,
                        color:         'rgba(255,255,255,0.6)',
                        fontFamily:    '"JetBrains Mono", monospace',
                        fontSize:      11,
                        padding:       '3px 10px',
                        cursor:        'pointer',
                        letterSpacing: '0.06em',
                        touchAction:   'manipulation',
                        userSelect:    'none',
                    }}
                >
                    {isFullscreen ? '✕ EXIT' : '⛶ FULLSCREEN'}
                </button>
            )}
        </PageContainer>
    );
}
