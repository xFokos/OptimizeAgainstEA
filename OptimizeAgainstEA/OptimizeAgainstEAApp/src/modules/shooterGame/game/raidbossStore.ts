import type { Transaction } from 'firebase/firestore';
import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { createListenable } from '../../../utils/listenable';
import { GAME_CONFIG, STARTER_DNA } from '../shooter.types';
import { initPopulation } from './ga/population';
import { evolve } from './ga/evolution';

const RAIDBOSS_DOC = doc(db, 'raidboss', 'current');

export interface RaidbossIndividual {
    dna:        number[];
    fitness:    number | null;
    evaluating: boolean;   // wird gerade von einem Spieler bewertet
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
const raidbossActive = { value: false, ...createListenable() };

export function getRaidbossActive(): boolean { return raidbossActive.value; }
export function setRaidbossActive(v: boolean) {
    raidbossActive.value = v;
    raidbossActive.notify();
}
export const subscribeRaidbossActive = raidbossActive.subscribe;

export function consumePendingSlot(): RaidbossSlot | null {
    const s = pendingSlot;
    pendingSlot = null;
    return s;
}

function makeInitialDoc(): RaidbossDoc {
    const pop = initPopulation(STARTER_DNA, GAME_CONFIG.POPULATION_SIZE);
    return {
        generation:       1,
        individuals:      pop.individuals.map(ind => ({ dna: ind.dna, fitness: null, evaluating: false })),
        populationSize:   GAME_CONFIG.POPULATION_SIZE,
        contributorCount: 0,
    };
}

// Normalisiert alte Docs ohne evaluating-Feld (Backward-Compat)
function normalize(data: RaidbossDoc): RaidbossDoc {
    return {
        ...data,
        individuals: data.individuals.map(ind => ({ ...ind, evaluating: ind.evaluating ?? false })),
    };
}

export async function getRaidbossStatus(): Promise<RaidbossDoc | null> {
    const snap = await getDoc(RAIDBOSS_DOC);
    if (!snap.exists()) return null;
    return snap.data() as RaidbossDoc;
}

// Beansprucht atomar einen freien Slot (nicht evaluating, fitness === null).
// Falls alle null-Slots gerade evaluiert werden (abgestürzte Spieler), werden die Flags resettet.
export async function claimRaidbossSlot(): Promise<RaidbossDoc> {
    // Initialisierung falls Dokument fehlt oder veraltete Größe
    const snap = await getDoc(RAIDBOSS_DOC);
    if (!snap.exists() || snap.data().populationSize !== GAME_CONFIG.POPULATION_SIZE) {
        const initial = makeInitialDoc();
        await setDoc(RAIDBOSS_DOC, initial);
    }

    let claimedDoc: RaidbossDoc | null = null;
    let claimedIndex = -1;

    await runTransaction(db, async (tx: Transaction) => {
        const txSnap = await tx.get(RAIDBOSS_DOC);
        if (!txSnap.exists()) throw new Error('Raidboss doc fehlt');

        const data = normalize(txSnap.data() as RaidbossDoc);

        // 1. Freier Slot: noch nicht bewertet, nicht reserviert
        let idx = data.individuals.findIndex(ind => ind.fitness === null && !ind.evaluating);
        // 2. Alle reserviert aber noch nicht bewertet → Duplikat erlaubt (wird später gemittelt)
        if (idx === -1)
            idx = data.individuals.findIndex(ind => ind.fitness === null);
        // 3. Alle schon bewertet → zufälligen nehmen (seltener Edge-Case)
        if (idx === -1)
            idx = Math.floor(Math.random() * data.individuals.length);

        const updated: RaidbossDoc = {
            ...data,
            individuals: data.individuals.map((ind, i) =>
                i === idx ? { ...ind, evaluating: true } : ind
            ),
        };

        tx.set(RAIDBOSS_DOC, updated);
        claimedDoc  = updated;
        claimedIndex = idx;
    });

    pendingSlot = {
        index: claimedIndex,
        dna:   (claimedDoc as unknown as RaidbossDoc).individuals[claimedIndex].dna,
        doc:   claimedDoc as unknown as RaidbossDoc,
    };
    return claimedDoc as unknown as RaidbossDoc;
}

// Schreibt Fitness für einen Slot; wenn alle bewertet → Evolution → neue Generation
export async function submitRaidbossFitness(index: number, fitness: number, claimedDoc: RaidbossDoc): Promise<void> {
    await runTransaction(db, async (tx: Transaction) => {
        const snap = await tx.get(RAIDBOSS_DOC);
        const data: RaidbossDoc = snap.exists()
            ? snap.data() as RaidbossDoc
            : claimedDoc;

        // Generation schon weitergerückt → überspringen
        if (data.generation !== claimedDoc.generation) return;

        const updated = normalize(data).individuals.map((ind, i) => {
            if (i !== index) return ind;
            // Duplikat: anderer Spieler hat diesen Slot schon submitted → Fitness mitteln
            const merged = ind.fitness !== null
                ? (ind.fitness + fitness) / 2
                : fitness;
            return { ...ind, fitness: merged, evaluating: false };
        });

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
            const evolved = evolve(pop, undefined, GAME_CONFIG.MUTATION_RATE, GAME_CONFIG.MUTATION_STRENGTH, 'uniform', 0.3);
            const newDoc: RaidbossDoc = {
                generation:       evolved.generation,
                individuals:      evolved.individuals.map(ind => ({ dna: ind.dna, fitness: null, evaluating: false })),
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
