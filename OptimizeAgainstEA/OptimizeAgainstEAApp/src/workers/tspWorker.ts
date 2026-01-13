// typescript
/// <reference lib="webworker" />

type Node = { id: number; x: number; y: number };

let nodes: Node[] = [];
let population: number[][] = [];
let bestPath: number[] = [];
let bestLength = Infinity;

const POP_SIZE = 200;
const MUTATION_RATE = 0.2;

function distance(a: Node, b: Node) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function pathLength(path: number[]) {
    let sum = 0;
    for (let i = 0; i < path.length; i++) {
        const a = nodes[path[i]];
        const b = nodes[path[(i + 1) % path.length]];
        sum += distance(a, b);
    }
    return sum;
}

function randomPath(): number[] {
    return [...nodes.map(n => n.id)].sort(() => Math.random() - 0.5);
}

function crossover(a: number[], b: number[]): number[] {
    const start = Math.floor(Math.random() * a.length);
    const end = start + Math.floor(Math.random() * (a.length - start));
    const slice = a.slice(start, end);
    const rest = b.filter(x => !slice.includes(x));
    return [...slice, ...rest];
}

function mutate(path: number[]) {
    if (Math.random() > MUTATION_RATE) return path;
    const i = Math.floor(Math.random() * path.length);
    const j = Math.floor(Math.random() * path.length);
    [path[i], path[j]] = [path[j], path[i]];
    return path;
}

function evolve(generations: number) {
    for (let g = 0; g < generations; g++) {
        const scored = population.map(p => ({
            path: p,
            score: pathLength(p),
        }));

        scored.sort((a, b) => a.score - b.score);

        if (scored[0].score <= bestLength) {
            bestLength = scored[0].score;
            bestPath = scored[0].path;
            postMessage({
                type: "BEST",
                payload: { path: bestPath, length: bestLength },
            });
        }

        const elite = scored.slice(0, POP_SIZE / 4).map(s => s.path);
        const next: number[][] = [...elite];

        while (next.length < POP_SIZE) {
            const p1 = elite[Math.floor(Math.random() * elite.length)];
            const p2 = elite[Math.floor(Math.random() * elite.length)];
            next.push(mutate(crossover(p1, p2)));
        }

        population = next;
    }
}

onmessage = (e) => {
    const { type, payload } = e.data || {};

    if (type === "INIT") {
        nodes = payload?.nodes ?? [];
        population = Array.from({ length: POP_SIZE }, randomPath);
        bestPath = [];
        bestLength = Infinity;
        return;
    }

    // Unterstütze sowohl "EVOLVE" (alt) als auch "RUN" (UI)
    if (type === "EVOLVE" || type === "RUN") {
        const generations = Number(payload?.generations) || 0;
        if (generations > 0 && nodes.length > 0 && population.length > 0) {
            evolve(generations);
        }
        return;
    }
};
