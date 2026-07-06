// hooks/useViewport.ts
import { useEffect, useState } from 'react';

interface Viewport {
    W: number;
    H: number;
}

const getViewport = (): Viewport => ({ W: window.innerWidth, H: window.innerHeight });

export const useViewport = (): Viewport => {
    const [vp, setVp] = useState(getViewport);

    useEffect(() => {
        const onResize = () => setVp(getViewport());
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    return vp;
};
