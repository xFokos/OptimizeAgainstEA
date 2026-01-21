export type WorldPoint = { x: number; y: number };

export type ToWorldFn = (px: number, py: number) => WorldPoint;

export type ScalarFieldFn = (x: number, y: number) => number;

export type DrawContourOptions = {
    step?: number;
};

export function drawContourLine(
    ctx: CanvasRenderingContext2D,
    fn: ScalarFieldFn,
    level: number,
    toWorld: ToWorldFn,
    width: number,
    height: number,
    options: DrawContourOptions = {}
) {
    const step = Math.floor(options.step ?? 4); // kleiner Schritt für Glätte
    const path = new Path2D();

    // Hilfsfunktion: glatte Linie zwischen Punkten
    const drawSmoothLine = (points: [number, number][]) => {
        if (points.length < 2) return;
        path.moveTo(points[0][0], points[0][1]);

        for (let i = 1; i < points.length - 1; i++) {
            const [x1, y1] = points[i];
            const [x2, y2] = points[i + 1];

            const xc = (x1 + x2) / 2;
            const yc = (y1 + y2) / 2;

            path.quadraticCurveTo(x1, y1, xc, yc);
        }

        // Letzter Punkt
        const last = points[points.length - 1];
        path.lineTo(last[0], last[1]);
    };

    for (let px = 0; px < width - step; px += step) {
        for (let py = 0; py < height - step; py += step) {
            const corners = [
                toWorld(px, py),
                toWorld(px + step, py),
                toWorld(px + step, py + step),
                toWorld(px, py + step),
            ];

            const values = corners.map(p => fn(p.x, p.y));
            const min = Math.min(...values);
            const max = Math.max(...values);
            if (min > level || max < level) continue;

            const edges: [number, number][] = [];

            // Top edge
            if (values[0] !== values[1] && (values[0] - level) * (values[1] - level) < 0) {
                const t = (level - values[0]) / (values[1] - values[0]);
                edges.push([px + t * step, py]);
            }
            // Right edge
            if (values[1] !== values[2] && (values[1] - level) * (values[2] - level) < 0) {
                const t = (level - values[1]) / (values[2] - values[1]);
                edges.push([px + step, py + t * step]);
            }
            // Bottom edge
            if (values[2] !== values[3] && (values[2] - level) * (values[3] - level) < 0) {
                const t = (level - values[2]) / (values[3] - values[2]);
                edges.push([px + (1 - t) * step, py + step]);
            }
            // Left edge
            if (values[3] !== values[0] && (values[3] - level) * (values[0] - level) < 0) {
                const t = (level - values[3]) / (values[0] - values[3]);
                edges.push([px, py + (1 - t) * step]);
            }

            if (edges.length >= 2) {
                drawSmoothLine(edges);
            }
        }
    }

    ctx.stroke(path);
}

/*
export type WorldPoint = { x: number; y: number };

export type ToWorldFn = (px: number, py: number) => WorldPoint;

export type ScalarFieldFn = (x: number, y: number) => number;

export type DrawContourOptions = {
    step?: number;
};

export function drawContourLine(
    ctx: CanvasRenderingContext2D,
    fn: ScalarFieldFn,
    level: number,
    toWorld: ToWorldFn,
    width: number,
    height: number,
    options: DrawContourOptions = {}
) {
    const maxStep = options.step ?? 4; // maximaler Schritt
    const minStep = 2; // kleinster Schritt in y
    const path = new Path2D();

    const drawSmoothLine = (points: [number, number][]) => {
        if (points.length < 2) return;
        path.moveTo(points[0][0], points[0][1]);

        for (let i = 1; i < points.length - 1; i++) {
            const [x1, y1] = points[i];
            const [x2, y2] = points[i + 1];
            const xc = (x1 + x2) / 2;
            const yc = (y1 + y2) / 2;
            path.quadraticCurveTo(x1, y1, xc, yc);
        }

        const last = points[points.length - 1];
        path.lineTo(last[0], last[1]);
    };

    let px = 0;
    const stepX = maxStep; // x-Schritt konstant

    while (px < width) {
        let py = 0;

        while (py < height) {
            // Ecken des aktuellen Quadrats
            const stepY = (() => {
                // Gradient nur in y-Richtung
                const dy = 1;

                const p = toWorld(px, py);
                const pY = toWorld(px, Math.min(py + dy, height));

                const grad = Math.abs(fn(p.x, p.y) - fn(pY.x, pY.y));

                return Math.max(grad > 2 ? 1 : maxStep, minStep);
            })();

            const corners = [
                toWorld(px, py),
                toWorld(Math.min(px + stepX, width), py),
                toWorld(Math.min(px + stepX, width), Math.min(py + stepY, height)),
                toWorld(px, Math.min(py + stepY, height)),
            ];

            const values = corners.map(p => fn(p.x, p.y));
            const min = Math.min(...values);
            const max = Math.max(...values);

            if (min <= level && max >= level) {
                const edges: [number, number][] = [];

                if (values[0] !== values[1] && (values[0] - level) * (values[1] - level) < 0) {
                    const t = (level - values[0]) / (values[1] - values[0]);
                    edges.push([px + t * stepX, py]);
                }
                if (values[1] !== values[2] && (values[1] - level) * (values[2] - level) < 0) {
                    const t = (level - values[1]) / (values[2] - values[1]);
                    edges.push([px + stepX, py + t * stepY]);
                }
                if (values[2] !== values[3] && (values[2] - level) * (values[3] - level) < 0) {
                    const t = (level - values[2]) / (values[3] - values[2]);
                    edges.push([px + (1 - t) * stepX, py + stepY]);
                }
                if (values[3] !== values[0] && (values[3] - level) * (values[0] - level) < 0) {
                    const t = (level - values[3]) / (values[0] - values[3]);
                    edges.push([px, py + (1 - t) * stepY]);
                }

                if (edges.length >= 2) drawSmoothLine(edges);
            }

            py += stepY; // adaptiv in y
        }

        px += stepX; // konstant in x
    }

    ctx.stroke(path);
}
 */
