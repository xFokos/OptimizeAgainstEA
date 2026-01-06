// tspWorker.ts
import type { Node } from "../types.ts";

let nodes: Node[] = [];
let population: number[][] = [];
let bestPath: number[] | null = null;

const POP_SIZE = 200;
const MUTATION_RATE = 0.02;

self.onmessage = (e) => {
    const { type, payload } = e.data;

    if (type === "INIT") {
        nodes = payload.nodes;
        initPopulation();
        return;
    }

    if (type === "RUN") {
        const { generations } = payload;
        runEvolution(generations);

        self.postMessage({
            type: "BEST",
            payload: {
                path: bestPath,
                length: pathLength(bestPath!),
            },
        });
    }
};

/* ---------------- EA Core ---------------- */

function initPopulation() {
    population = Array.from({ length: POP_SIZE }, randomPath);
    bestPath = population[0];
}

function runEvolution(generations: number) {
    for (let g = 0; g < generations; g++) {
        population.sort((a, b) => pathLength(a) - pathLength(b));
        bestPath = population[0];

        const survivors = population.slice(0, POP_SIZE / 2);
        const children = [];

        while (children.length < POP_SIZE / 2) {
            const p1 = pick(survivors);
            const p2 = pick(survivors);
            let child = crossover(p1, p2);
            if (Math.random() < MUTATION_RATE) mutate(child);
            children.push(child);
        }

        population = [...survivors, ...children];
    }
}

/* ---------------- Helpers ---------------- */

function randomPath(): number[] {
    return shuffle(nodes.map(n => n.id));
}

function pathLength(path: number[]): number {
    let sum = 0;
    for (let i = 0; i < path.length; i++) {
        const a = nodes[path[i]];
        const b = nodes[(i + 1) % path.length];
        sum += Math.hypot(a.x - b.x, a.y - b.y);
    }
    return sum;
}

function crossover(a: number[], b: number[]): number[] {
    const start = Math.floor(Math.random() * a.length);
    const end = start + Math.floor(Math.random() * (a.length - start));

    const slice = a.slice(start, end);
    return [
        ...slice,
        ...b.filter(x => !slice.includes(x)),
    ];
}

function mutate(path: number[]) {
    const i = Math.floor(Math.random() * path.length);
    const j = Math.floor(Math.random() * path.length);
    [path[i], path[j]] = [path[j], path[i]];
}

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]) {
    return [...arr].sort(() => Math.random() - 0.5);
}
