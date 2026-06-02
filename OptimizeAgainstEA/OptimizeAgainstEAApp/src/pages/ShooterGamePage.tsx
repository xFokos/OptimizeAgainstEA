import { useScaledCanvas } from '../hooks/useScaledCanvas';
import { ARENA } from '../modules/shooterGame/shooter.types';
import PageContainer from "../components/layout/PageContainer.tsx";
import {ShooterCanvas} from "../modules/shooterGame/components/ShooterCanvas.tsx";
import {DNADisplay} from "../modules/shooterGame/components/dnaDisplay.tsx";

const DNA_SIDEBAR_WIDTH = 280;

export default function ShooterGamePage() {
    const {containerRef, scale} = useScaledCanvas({
        baseWidth: ARENA.WIDTH,
        baseHeight: ARENA.HEIGHT,
        sidebarWidth: DNA_SIDEBAR_WIDTH,
    });

    return (
        <PageContainer>
            <div ref={containerRef} style={{
                display: 'flex',
                width: '100%',
                height: '100%',
                padding: '16px',
                boxSizing: 'border-box',
                gap: '16px',
                alignItems: 'center',
            }}>
                {/* Canvas zentriert in seinem Flex-Bereich */}
                <div style={{
                    flex: 1,
                    height: ARENA.HEIGHT * scale,
                    position: 'relative',
                    minWidth: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}>
                    <ShooterCanvas scale={scale}/>
                </div>

                {/* Sidebar rechts */}
                <div style={{
                    width: DNA_SIDEBAR_WIDTH,
                    flexShrink: 0,
                    height: ARENA.HEIGHT * scale,
                }}>
                    <DNADisplay/>
                </div>
            </div>
        </PageContainer>
    );
}