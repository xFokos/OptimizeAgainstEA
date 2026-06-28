import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScaledCanvas } from '../hooks/useScaledCanvas';
import { ARENA } from '../modules/shooterGame/shooter.types';
import { GameLayout } from '../components/layout/GameLayout';
import { ShooterLeftBar } from '../components/layout/ShooterLeftBar';
import { ShooterCanvas } from '../modules/shooterGame/components/ShooterCanvas';
import { DNADisplay } from '../modules/shooterGame/components/dnaDisplay';
import { MobileJoystickZone } from '../modules/shooterGame/components/MobileJoystickZone';
import { MobileAimZone } from '../modules/shooterGame/components/MobileAimZone';
import { useInput } from '../modules/shooterGame/hooks/useInput';
import PageContainer from '../components/layout/PageContainer';

function useIsMobileLandscape() {
    const check = () => typeof window !== 'undefined' && window.innerHeight < 500;
    const [is, setIs] = useState(check);
    useEffect(() => {
        const h = () => setIs(check());
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);
    return is;
}

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

export default function ShooterGamePage() {
    const navigate             = useNavigate();
    const isMobileLandscape    = useIsMobileLandscape();
    const inputRef             = useInput();
    const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
    const leaveHandlerRef      = useRef<(() => Promise<void>) | undefined>(undefined);

    const { containerRef, scale } = useScaledCanvas({
        baseWidth:  ARENA.WIDTH,
        baseHeight: ARENA.HEIGHT + 44,  // +44 = TugBar-Höhe in ShooterCanvas
        padding:    isMobileLandscape ? 4 : 16,
    });

    return (
        <PageContainer>
            <GameLayout
                canvasRef={containerRef}
                touchLayout={isMobileLandscape}
                leftBar={
                    isMobileLandscape
                        ? <MobileJoystickZone inputRef={inputRef} />
                        : <ShooterLeftBar
                            onAnalytics={() => navigate('/Analytics')}
                            onLobby={async () => {
                                await leaveHandlerRef.current?.();
                                navigate('/lobby/shooter', { state: { mode: 'normal' } });
                            }}
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
                />
            </GameLayout>

            {/* Zurück zur Lobby – nur auf Mobile sichtbar (Desktop hat die linke Nav-Bar) */}
            {isMobileLandscape && (
                <button
                    onClick={async () => {
                        await leaveHandlerRef.current?.();
                        navigate('/lobby/shooter', { state: { mode: 'normal' } });
                    }}
                    style={{
                        position:       'fixed',
                        top:            6,
                        left:           6,
                        zIndex:         200,
                        background:     'rgba(0,0,0,0.55)',
                        border:         '1px solid rgba(255,255,255,0.18)',
                        borderRadius:   6,
                        color:          'rgba(255,255,255,0.6)',
                        fontFamily:     '"JetBrains Mono", monospace',
                        fontSize:       11,
                        padding:        '3px 10px',
                        cursor:         'pointer',
                        letterSpacing:  '0.06em',
                        backdropFilter: 'blur(4px)',
                        touchAction:    'manipulation',
                        userSelect:     'none',
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
                        position:        'fixed',
                        top:             6,
                        left:            '50%',
                        transform:       'translateX(-50%)',
                        zIndex:          200,
                        background:      isFullscreen
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(0,0,0,0.55)',
                        border:          '1px solid rgba(255,255,255,0.18)',
                        borderRadius:    6,
                        color:           'rgba(255,255,255,0.6)',
                        fontFamily:      '"JetBrains Mono", monospace',
                        fontSize:        11,
                        padding:         '3px 10px',
                        cursor:          'pointer',
                        letterSpacing:   '0.06em',
                        backdropFilter:  'blur(4px)',
                        touchAction:     'manipulation',
                        userSelect:      'none',
                    }}
                >
                    {isFullscreen ? '✕ EXIT' : '⛶ FULLSCREEN'}
                </button>
            )}
        </PageContainer>
    );
}
