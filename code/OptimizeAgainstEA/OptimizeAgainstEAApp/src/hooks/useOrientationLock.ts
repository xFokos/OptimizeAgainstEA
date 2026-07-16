import { useEffect } from 'react';

// Sperrt die Bildschirmausrichtung und entsperrt sie beim Unmounten.
// Schlägt auf iOS Safari still fehl (nicht unterstützt).
// Auf Android Chrome: funktioniert nur wenn Fullscreen aktiv ist.
// Re-locked bei jedem fullscreenchange (z.B. wenn Browser-UI kurz auftaucht und verschwindet).
export function useOrientationLock(type: string = 'landscape') {
    useEffect(() => {
        const tryLock = () => {
            if (!document.fullscreenElement) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            try { (screen.orientation as any).lock(type).catch(() => {}); } catch {}
        };

        tryLock();
        document.addEventListener('fullscreenchange', tryLock);

        return () => {
            document.removeEventListener('fullscreenchange', tryLock);
            try { screen.orientation.unlock(); } catch {}
        };
    }, [type]);
}
