// Shared, website-wide hint system. Import everything from here.
//
//   import { HintsProvider, HintLayer, HintToggle, useHints, HintPopover } from '../components/hints';
//
// Edit hint text in ./hintContent.ts. Flip COMPI_MODE there to switch between
// the Compi mascot presentation and plain hints.
import './hints.css';

export { HintsProvider, useHints, fillTemplate } from './HintContext';
export type { HintAction, ActiveHint } from './HintContext';
export { HintLayer } from './HintLayer';
export { HintToggle } from './HintToggle';
export { HintPopover } from './HintPopover';
export { CompiBubble } from './CompiBubble';
export { HINTS, COMPI_MODE } from './hintContent';
export type { HintId, HintDef } from './hintContent';
