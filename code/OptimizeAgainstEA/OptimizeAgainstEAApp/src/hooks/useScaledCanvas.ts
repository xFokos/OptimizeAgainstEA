// hooks/useScaledCanvas.ts
import { useRef, useEffect, useState } from 'react';

interface UseScaledCanvasOptions {
    baseWidth:    number;
    baseHeight:   number;
    sidebarWidth?: number;  // optionaler Platz für Sidebar
    padding?:     number;
}

export const useScaledCanvas = ({
                                    baseWidth,
                                    baseHeight,
                                    sidebarWidth = 0,
                                    padding = 16,
                                }: UseScaledCanvasOptions) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const updateScale = () => {
            if (!containerRef.current) return;

            const availW = containerRef.current.clientWidth  - sidebarWidth - padding * 3;
            const availH = containerRef.current.clientHeight - padding * 2;

            const scaleX = availW / baseWidth;
            const scaleY = availH / baseHeight;

            setScale(Math.min(scaleX, scaleY));
        };

        updateScale();

        const observer = new ResizeObserver(updateScale);
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [baseWidth, baseHeight, sidebarWidth, padding]);

    return { containerRef, scale };
};