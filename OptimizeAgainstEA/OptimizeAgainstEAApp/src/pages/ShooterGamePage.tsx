import { useRef, useEffect, useState } from 'react';
import { ShooterCanvas } from '../modules/shooterGame/components/ShooterCanvas';
import PageContainer from '../components/layout/PageContainer';
import { DNADisplay } from '../modules/shooterGame/components/dnaDisplay';
import { ARENA } from '../modules/shooterGame/shooter.types';

const DNA_SIDEBAR_WIDTH = 280; // feste Sidebar-Breite
const PADDING = 16;

export default function ShooterGamePage() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const updateScale = () => {
            if (!containerRef.current) return;

            const availW = containerRef.current.clientWidth - DNA_SIDEBAR_WIDTH - PADDING * 3;
            const availH = containerRef.current.clientHeight - PADDING * 2;

            const scaleX = availW / ARENA.WIDTH;
            const scaleY = availH / ARENA.HEIGHT;

            setScale(Math.min(scaleX, scaleY, 1)); // nie größer als 1:1
        };

        updateScale();

        const observer = new ResizeObserver(updateScale); // reagiert auf Größenänderungen
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <PageContainer>
            <div
                ref={containerRef}
                style={{
                    display:   'flex',
                    width:     '100%',
                    height:    '100%',
                    gap:       `${PADDING}px`,
                    padding:   `${PADDING}px`,
                    boxSizing: 'border-box',
                    alignItems: 'flex-start',
                }}
            >
                {/* Canvas-Bereich – nimmt verfügbaren Platz ein */}
                <div style={{
                    flex:     1,
                    height:   ARENA.HEIGHT * scale,
                    position: 'relative',
                    minWidth: 0, // wichtig damit flex nicht überläuft
                }}>
                    <ShooterCanvas scale={scale} />
                </div>

                {/* Sidebar – feste Breite */}
                <div style={{
                    width:     DNA_SIDEBAR_WIDTH,
                    flexShrink: 0, // Sidebar wird nie schmaler gedrückt
                }}>
                    <DNADisplay />
                </div>
            </div>
        </PageContainer>
    );
}