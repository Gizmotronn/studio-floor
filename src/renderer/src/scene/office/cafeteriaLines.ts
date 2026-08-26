// Small-talk for a friendly shared studio. Lines are deliberately generic so
// every current starter avatar and every future custom avatar feels at home.

import type { OfficeCharacterName } from './cast';

export type BreakSpot = 'coffee' | 'vending' | 'snack' | 'table';
type Exchange = readonly string[];

const pick = <T,>(items: readonly T[], seed: number): T =>
  items[((seed % items.length) + items.length) % items.length];

const SPOT_LINES: Record<BreakSpot, readonly string[]> = {
  coffee: ['fresh cup, fresh idea', 'coffee first, then the clever bit', 'this smells promising'],
  vending: ['tiny snack, huge morale boost', 'the machine accepted my choice', 'a highly strategic snack'],
  snack: ['saving one for later', 'thinking break', 'snack-powered research'],
  table: ['how is the build going?', 'good idea—writing that down', 'five quiet minutes, please'],
};

const EXCHANGES: readonly Exchange[] = [
  ['want a second pair of eyes?', 'always. thank you.'],
  ['the idea is getting clearer.', 'that is the best feeling.'],
  ['quick break?', 'perfect timing.'],
  ['did the test pass?', 'green across the board.'],
  ['want to trade notes?', 'yes, let’s compare.'],
  ['small step, then the next one.', 'that usually works.'],
  ['is this ready to share?', 'give me one more minute.'],
  ['how can I help?', 'a calm read-through would be great.'],
];

export function pickSoloLine(_character: OfficeCharacterName, spot: BreakSpot, seed: number): string {
  return pick(SPOT_LINES[spot], seed);
}

export function pickExchange(_speaker: OfficeCharacterName, seed: number): Exchange {
  return pick(EXCHANGES, seed);
}
