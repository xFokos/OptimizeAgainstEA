export interface Vector2D {
    x: number;
    y: number;
}

export const vec = {
    add: (a: Vector2D, b: Vector2D): Vector2D => ({
        x: a.x + b.x,
        y: a.y + b.y,
    }),

    sub: (a: Vector2D, b: Vector2D): Vector2D => ({
        x: a.x - b.x,
        y: a.y - b.y,
    }),

    scale: (v: Vector2D, s: number): Vector2D => ({
        x: v.x * s,
        y: v.y * s,
    }),

    length: (v: Vector2D): number =>
        Math.sqrt(v.x * v.x + v.y * v.y),

    normalize: (v: Vector2D): Vector2D => {
        const len = vec.length(v);
        return len === 0 ? { x: 0, y: 0 } : vec.scale(v, 1 / len);
    },

    distance: (a: Vector2D, b: Vector2D): number =>
        vec.length(vec.sub(b, a)),

    // Winkel von a nach b in Radians
    angle: (from: Vector2D, to: Vector2D): number =>
        Math.atan2(to.y - from.y, to.x - from.x),

    // Richtungsvektor aus einem Winkel (Radians)
    fromAngle: (angle: number): Vector2D => ({
        x: Math.cos(angle),
        y: Math.sin(angle),
    }),

    // Punkt innerhalb eines Rechtecks halten (z.B. Spielfeld-Grenzen)
    clamp: (v: Vector2D, minX: number, maxX: number, minY: number, maxY: number): Vector2D => ({
        x: Math.max(minX, Math.min(maxX, v.x)),
        y: Math.max(minY, Math.min(maxY, v.y)),
    }),

    // Senkrechter Vektor (90° links) – nützlich für Ausweich-KI
    perpendicular: (v: Vector2D): Vector2D => ({
        x: -v.y,
        y: v.x,
    }),

    // Dreht den Vector 180 Grad
    flip: (v: Vector2D) : Vector2D => ({
       x: -v.x,
       y: -v.y,
    }),

    // Lineares Interpolieren zwischen zwei Punkten
    lerp: (a: Vector2D, b: Vector2D, t: number): Vector2D => ({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
    }),

    zero: (): Vector2D => ({ x: 0, y: 0 }),
};