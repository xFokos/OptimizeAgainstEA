// utils/functions.ts
export type MathFunction = (x: number, y: number) => number;

export const bealeFunction: MathFunction = (x, y) =>
    Math.pow(1.5 - x + x * y, 2) +
    Math.pow(2.25 - x + x * y * y, 2) +
    Math.pow(2.625 - x + x * y * y * y, 2);
