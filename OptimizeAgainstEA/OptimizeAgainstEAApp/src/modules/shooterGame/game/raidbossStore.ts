import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { GAME_CONFIG, STARTER_DNA } from '../shooter.types';
import { initPopulation } from './ga/population';
import { evolve } from './ga/evolution';

const RAIDBOSS_DOC = doc(db, 'raidboss', 'current');

export interface RaidbossIndividual {
    dna:     number[];
    fitness: number | null;
}

export interface RaidbossDoc {
    generation:       number;
    individuals:      RaidbossIndividual[];
    populationSize:   number;
    contributorCount: number;
}

export interface RaidbossSlot {
    index: number;
    dna:   number[];
    doc:   RaidbossDoc;
}

// Pending slot: gesetzt von claimRaidbossSlot(), gelesen von ShooterCanvas
let pendingSlot: RaidbossSlot | null = null;

// Reaktiver Store für Raidboss-Modus — DNADisplay subscribed darauf
let _raidbossActive = false;
const _raidbossListeners = new Set<() => void>();

export function getRaidbossActive(): boolean { return _raidbossActive; }
export function setRaidbossActive(v: boolean) {
    _raidbossActive = v;
    _raidbossListeners.forEach(fn => fn());
}
export function subscribeRaidbossActive(fn: () => void): () => void {
    _raidbossListeners.add(fn);
    return () => { _raidbossListeners.delete(fn); };
}

export function consumePendingSlot(): RaidbossSlot | null {
    const s = pendingSlot;
    pendingSlot = null;
    return s;
}

function makeInitialDoc(): RaidbossDoc {
    const pop = initPopulation(STARTER_DNA, GAME_CONFIG.POPULATION_SIZE);
    return {
        generation:       1,
        individuals:      pop.individuals.map(ind => ({ dna: ind.dna, fitness: null })),
        populationSize:   GAME_CONFIG.POPULATION_SIZE,
        contributorCount: 0,
    };
}

export async function getRaidbossStatus(): Promise<RaidbossDoc | null> {
    const snap = await getDoc(RAIDBOSS_DOC);
    if (!snap.exists()) return null;
    return snap.data() as RaidbossDoc;
}

// Lädt aktuelle Population, sucht erstes unbewertetes Individuum und speichert es als pendingSlot
export async function claimRaidbossSlot(): Promise<RaidbossDoc> {
    const snap = await getDoc(RAIDBOSS_DOC);

    let data: RaidbossDoc;
    if (!snap.exists() || snap.data().populationSize !== GAME_CONFIG.POPULATION_SIZE) {
        data = makeInitialDoc();
        await setDoc(RAIDBOSS_DOC, data);
    } else {
        data = snap.data() as RaidbossDoc;
    }

    const index = data.individuals.findIndex(ind => ind.fitness === null);
    // Falls alle bewertet (Runde läuft gerade): nimm zufälliges Individuum
    const claimIndex = index !== -1
        ? index
        : Math.floor(Math.random() * data.individuals.length);

    pendingSlot = { index: claimIndex, dna: data.individuals[claimIndex].dna, doc: data };
    return data;
}

// Schreibt Fitness für einen Slot; wenn alle bewertet → Evolution → neue Generation
export async function submitRaidbossFitness(index: number, fitness: number, claimedDoc: RaidbossDoc): Promise<void> {
    await runTransaction(db, async (tx) => {
        const snap = await tx.get(RAIDBOSS_DOC);
        const data: RaidbossDoc = snap.exists()
            ? snap.data() as RaidbossDoc
            : claimedDoc;

        // Generation schon weitergerückt → überspringen
        if (data.generation !== claimedDoc.generation) return;

        const updated = data.individuals.map((ind, i) =>
            i === index ? { ...ind, fitness } : ind
        );

        const allEvaluated = updated.every(ind => ind.fitness !== null);

        if (allEvaluated) {
            // Alle bewertet → Evolution
            const individuals = updated.map(ind => ({
                dna:     ind.dna,
                fitness: ind.fitness as number,
            }));
            const fitnesses = individuals.map(i => i.fitness);
            const pop = {
                generation:  data.generation,
                individuals,
                bestFitness: Math.max(...fitnesses),
                avgFitness:  fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
            };
            const evolved = evolve(pop, undefined, GAME_CONFIG.MUTATION_RATE, GAME_CONFIG.MUTATION_STRENGTH);
            const newDoc: RaidbossDoc = {
                generation:       evolved.generation,
                individuals:      evolved.individuals.map(ind => ({ dna: ind.dna, fitness: null })),
                populationSize:   data.populationSize,
                contributorCount: data.contributorCount + 1,
            };
            tx.set(RAIDBOSS_DOC, newDoc);
        } else {
            tx.set(RAIDBOSS_DOC, {
                ...data,
                individuals:      updated,
                contributorCount: data.contributorCount + 1,
            });
        }
    });
}
