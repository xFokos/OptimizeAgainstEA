/**
 * PeakFinder presentation helper.
 *
 * Internally the engine keeps its original convention: 0 = the summit (the
 * global optimum, the spot the player/EA is hunting) and 1 = far away in the
 * valley. That convention drives both the colour gradient and the EA — which
 * MINIMISES fitness, i.e. climbs toward 0 — so neither needs to change for the
 * PeakFinder theme.
 *
 * For the player we present the inverted "height": 1 = the summit, 0 = the
 * valley floor. Use this ONLY for numbers shown to the player. Never feed the
 * result into colour sampling or EA logic — those still use the raw value.
 */
export const valueToHeight = (value: number): number =>
  Math.max(0, Math.min(1, 1 - value));
