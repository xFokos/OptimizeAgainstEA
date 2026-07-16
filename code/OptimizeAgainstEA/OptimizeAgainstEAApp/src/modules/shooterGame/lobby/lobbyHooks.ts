import { useEffect, useState } from 'react';

// ---- Mobile-Breakpoint Hook ----

export function useMobile(bp = 768) {
    const [mob, setMob] = useState(() => window.innerWidth < bp);
    useEffect(() => {
        const h = () => setMob(window.innerWidth < bp);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, [bp]);
    return mob;
}

// ---- Viewport-height zoom: shrinks the lobby on small screens ----

export function useZoom(referenceH = 900, minZoom = 0.72) {
    const [h, setH] = useState(() => window.innerHeight);
    useEffect(() => {
        const update = () => setH(window.innerHeight);
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);
    return Math.min(1, Math.max(minZoom, h / referenceH));
}

// ---- Fullscreen vor dem Navigieren zum Spiel anfordern ----
// Chrome on Android erlaubt orientation.lock nur in Fullscreen → innerhalb des User-Gesture-Kontexts aufrufen

export async function enterGameFullscreen() {
    // pointer: coarse = Touch als primäres Eingabegerät (Phones, Tablets)
    // zuverlässiger als Screen-Größe, die bei großen Tablets versagt
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    if (!isTouchDevice) return;
    if (!document.fullscreenElement) {
        try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch { /* Fullscreen verweigert — Spiel läuft dann einfach im Fenster */ }
    }
}
