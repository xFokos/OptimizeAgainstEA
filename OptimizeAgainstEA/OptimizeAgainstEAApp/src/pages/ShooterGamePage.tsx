import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useScaledCanvas } from '../hooks/useScaledCanvas';
import { useOrientationLock } from '../hooks/useOrientationLock';
import { useViewport } from '../hooks/useViewport';
import { ARENA } from '../modules/shooterGame/shooter.types';
import { GameLayout } from '../components/layout/GameLayout';
import { ShooterLeftBar } from '../components/layout/ShooterLeftBar';
import { ShooterCanvas } from '../modules/shooterGame/components/ShooterCanvas';
import { DNADisplay } from '../modules/shooterGame/components/dnaDisplay';
import { MobileJoystickZone } from '../modules/shooterGame/components/MobileJoystickZone';
import { MobileAimZone } from '../modules/shooterGame/components/MobileAimZone';
import { useInput } from '../modules/shooterGame/hooks/useInput';
import { gameStore } from '../modules/shooterGame/game/gameStore';
import PageContainer from '../components/layout/PageContainer';

const supportsFullscreen =
    typeof document !== 'undefined' && 'requestFullscreen' in document.documentElement;

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

// Drehhinweis-Overlay: zeigt wenn das Gerät im Portrait-Modus ist und zu klein für Desktop-Layout
function RotateOverlay() {
    return (
        <div style={{
            position:       'fixed',
            inset:          0,
            zIndex:         9999,
            background:     '#0f0f1a',
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            20,
        }}>
            <div style={{
                fontSize:   56,
                lineHeight: 1,
                animation:  'rotateHint 2.4s ease-in-out infinite',
            }}>
                📱
            </div>
            <p style={{
                color:       'rgba(255,255,255,0.65)',
                fontFamily:  '"JetBrains Mono", monospace',
                fontSize:    13,
                letterSpacing: '0.06em',
                margin:      0,
            }}>
                Please rotate device
            </p>
            <style>{`
                @keyframes rotateHint {
                    0%, 100% { transform: rotate(0deg); }
                    40%       { transform: rotate(90deg); }
                    60%       { transform: rotate(90deg); }
                }
            `}</style>
        </div>
    );
}

export default function ShooterGamePage() {
    const navigate             = useNavigate();
    const location             = useLocation();
    const tutorial             = !!(location.state as { tutorial?: boolean } | null)?.tutorial;
    const { W, H }             = useViewport();
    const isMobileDevice       = Math.min(W, H) < 550;   // kleines Gerät?
    const isPortrait           = H > W;                   // hochkant?
    const isMobileLandscape    = isMobileDevice && !isPortrait;
    useOrientationLock('landscape');
    const inputRef             = useInput();
    const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
    const leaveHandlerRef      = useRef<(() => Promise<void>) | undefined>(undefined);

    // Tutorial round is single-use — leaving early (nav bar / mobile back
    // button) should not leave a half-finished round for a later real Play
    // to accidentally restore.
    const leaveToLobby = async () => {
        await leaveHandlerRef.current?.();
        if (tutorial) {
            gameStore.state = null as unknown as typeof gameStore.state;
            gameStore.notify();
        }
        navigate('/lobby/shooter', { state: { mode: 'normal' } });
    };

    const { containerRef, scale } = useScaledCanvas({
        baseWidth:  ARENA.WIDTH,
        baseHeight: ARENA.HEIGHT + 44,  // +44 = TugBar-Höhe in ShooterCanvas (inkl. Mod-Progress-Akzent)
        padding:    isMobileLandscape ? 4 : 16,
    });

    return (
        <PageContainer>
            {/* Overlay wenn das Handy im Portrait-Modus ist */}
            {isMobileDevice && isPortrait && <RotateOverlay />}

            <GameLayout
                canvasRef={containerRef}
                touchLayout={isMobileLandscape}
                leftBar={
                    isMobileLandscape
                        ? <MobileJoystickZone inputRef={inputRef} />
                        : <ShooterLeftBar
                            onAnalytics={() => navigate('/Analytics')}
                            onLobby={leaveToLobby}
                          />
                }
                sidebar={
                    isMobileLandscape
                        ? <MobileAimZone inputRef={inputRef} />
                        : <DNADisplay />
                }
            >
                <ShooterCanvas
                    scale={scale}
                    externalInputRef={isMobileLandscape ? inputRef : undefined}
                    leaveHandlerRef={leaveHandlerRef}
                    tutorial={tutorial}
                />
            </GameLayout>

            {/* Zurück zur Lobby – nur auf Mobile sichtbar (Desktop hat die linke Nav-Bar) */}
            {isMobileLandscape && (
                <button
                    onClick={async () => {
                        await leaveHandlerRef.current?.();
                        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
                        if (tutorial) {
                            gameStore.state = null as unknown as typeof gameStore.state;
                            gameStore.notify();
                        }
                        navigate('/lobby/shooter', { state: { mode: 'normal' } });
                    }}
                    style={{
                        position:      'fixed',
                        top:           6,
                        left:          6,
                        zIndex:        200,
                        background:    'rgba(15,15,26,0.85)',
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
                    ← Lobby
                </button>
            )}

            {/* Fullscreen-Toggle – nur auf Geräten die die API unterstützen (nicht iOS Safari) */}
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
