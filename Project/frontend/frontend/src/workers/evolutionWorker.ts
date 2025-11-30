// evolutionWorker.ts

// Type definitions for messages
interface InitMessage {
    type: "init";
    populationSize: number;
    mutationRate: number;
}

interface StepMessage {
    type: "step";
}

interface StopMessage {
    type: "stop";
}

let running = false;
let generation = 0;
let population: number[] = []; // Example: population represented by numbers
let mutationRate = 0.1;

// Utility: returns a random number (simulating fitness)
function randomFitness() {
    return Math.random();
}

// Mutation example
function mutate(value: number) {
    if (Math.random() < mutationRate) {
        return value + (Math.random() - 0.5);
    }
    return value;
}

// Evolution step
function evolvePopulation() {
    population = population.map((v) => mutate(v));
}

// Worker message handler
self.onmessage = (event) => {
    const msg = event.data as InitMessage | StepMessage | StopMessage;

    // Initialize the algorithm
    if (msg.type === "init") {
        generation = 0;
        mutationRate = msg.mutationRate;
        population = Array.from({ length: msg.populationSize }, () => randomFitness());
        running = true;

        postMessage({
            type: "initialized",
            populationSize: population.length,
        });

        runLoop();
    }

    // Stop the algorithm
    if (msg.type === "stop") {
        running = false;
        postMessage({ type: "stopped" });
    }
};

// Evolution loop
function runLoop() {
    if (!running) return;

    evolvePopulation();
    generation++;

    const best = Math.max(...population);

    // Send update back to main thread
    postMessage({
        type: "update",
        generation,
        bestFitness: best,
    });

    // Run again soon
    setTimeout(runLoop, 20); // Lower = smoother animation
}
