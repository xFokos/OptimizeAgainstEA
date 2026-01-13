// File: OptimizeAgainstEAApp/src/workers/tspWorker.ts
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

function crossoverWithInfo(a: number[], b: number[]) {
    const start = Math.floor(Math.random() * a.length);
    const end = start + Math.floor(Math.random() * (a.length - start));
    const slice = a.slice(start, end);
    const rest = b.filter(x => !slice.includes(x));
    const child = [...slice, ...rest];
    return { child, start, end };
}

function mutateWithInfo(path: number[]) {
    const out = [...path];
    if (Math.random() > MUTATION_RATE) return { mutated: false, path: out, swap: null };
    const i = Math.floor(Math.random() * out.length);
    const j = Math.floor(Math.random() * out.length);
    [out[i], out[j]] = [out[j], out[i]];
    return { mutated: true, path: out, swap: { i, j } };
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

            // choose two parents from top elite (if available) to visualize crossover
            const elite = scored.slice(0, Math.max(2, Math.floor(POP_SIZE / 4))).map(s => s.path);
            let parentA = elite[0];
            let parentB = elite.length > 1 ? elite[1] : (population[Math.floor(Math.random() * population.length)]);

            // produce child via crossover and then possibly mutate, capture before/after
            const { child: childBefore } = crossoverWithInfo(parentA, parentB);
            const mutInfo = mutateWithInfo(childBefore);
            const childAfter = mutInfo.path;

            postMessage({
                type: "BEST_DETAILED",
                payload: {
                    path: bestPath,
                    length: bestLength,
                    parentA,
                    parentB,
                    childBefore,
                    childAfter,
                    mutated: mutInfo.mutated,
                    mutationSwap: mutInfo.swap,
                },
            });

            // also send the old simple BEST message to keep backwards compatibility
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
            const { child } = crossoverWithInfo(p1, p2);
            next.push(mutateWithInfo(child).path);
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

    if (type === "EVOLVE" || type === "RUN") {
        const generations = Number(payload?.generations) || 0;
        if (generations > 0 && nodes.length > 0 && population.length > 0) {
            evolve(generations);
        }
        return;
    }
};
