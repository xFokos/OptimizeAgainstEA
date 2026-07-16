// Shared, site-wide Help system. Import everything from here.
//
//   import { HelpButton } from '../components/help';
//   <HelpButton topic="shooter.solo" />
//
// Add new content in ./helpContent.ts — no other wiring needed.
import './help.css';

export { HelpButton } from './HelpButton';
export { MobileHelpBar } from './MobileHelpBar';
export { HelpModal } from './HelpModal';
export { HELP_TOPICS } from './helpContent';
export type { HelpTopicId, HelpTopic } from './helpContent';
