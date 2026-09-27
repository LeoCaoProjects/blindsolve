import { Solve, SolveMemo } from '../types/solve';

const memoA: SolveMemo = {
  corners: [
  { pair: 'BQ', word: 'barbecue' },
  { pair: 'NF', word: 'Netflix' },
  { pair: 'KW', word: 'kiwi' },
  { pair: 'HP', word: 'printer' }],

  edges: [
  { pair: 'MI', word: 'Mickey' },
  { pair: 'SE', word: 'Sweden' },
  { pair: 'KG', word: 'kilogram' },
  { pair: 'PB', word: 'peanut butter' },
  { pair: 'WL', word: 'wolf' }],

  edgeBreakAt: 4
};

const memoB: SolveMemo = {
  corners: [
  { pair: 'UF', word: 'UFO' },
  { pair: 'DM', word: 'Depeche Mode' },
  { pair: 'SI', word: 'Sicily' },
  { pair: 'OJ', word: 'orange juice' }],

  edges: [
  { pair: 'QN', word: 'queen' },
  { pair: 'CB', word: 'cowboy' },
  { pair: 'LH', word: 'lighthouse' },
  { pair: 'VR', word: 'headset' },
  { pair: 'EK', word: 'eel' },
  { pair: 'TG', word: 'Telegram' }]

};

const memoC: SolveMemo = {
  corners: [
  { pair: 'WC', word: 'World Cup' },
  { pair: 'RM', word: 'room' },
  { pair: 'JH', word: 'jackhammer' },
  { pair: 'TS', word: 'Taylor Swift' },
  { pair: 'LG', word: 'LG TV' }],

  edges: [
  { pair: 'AR', word: 'rifle' },
  { pair: 'CO', word: 'cow' },
  { pair: 'DF', word: 'dumbbell' },
  { pair: 'UX', word: 'UX' },
  { pair: 'GK', word: 'goalkeeper' }],

  cornerBreakAt: 4,
  edgeBreakAt: 4
};

/** Earlier vocabulary: WC was "toilet", DF was "dolphin". */
const memoCEarly: SolveMemo = {
  ...memoC,
  corners: memoC.corners.map((p) => p.pair === 'WC' ? { ...p, word: 'toilet' } : p),
  edges: memoC.edges.map((p) => p.pair === 'DF' ? { ...p, word: 'dolphin' } : p)
};

export const seedSolves: Solve[] = [
{ id: 's10', index: 10, time: 84830, memoTime: 33400, penalty: 'ok', scramble: "D2 F' L2 U2 B2 D' R2 U F2 L2 B' R D' F U' B' L' U2 R' Fw Uw'", date: '2026-09-24T21:46:12', memo: memoA },
{ id: 's9', index: 9, time: 78060, memoTime: 29870, penalty: 'ok', scramble: "F2 U' R2 D B2 L2 D' F2 U2 R' B D2 L F' R2 U' B' D' L2 Rw Uw2", date: '2026-09-24T21:42:40', memo: memoB },
{ id: 's8', index: 8, time: 89520, memoTime: 35100, penalty: '+2', scramble: "L' U2 F2 R2 D' B2 U L2 U' F2 R B' L D F' U2 R' F' Uw", date: '2026-09-24T21:38:55', memo: memoC },
{ id: 's7', index: 7, time: 102190, memoTime: 41020, penalty: 'dnf', scramble: "B2 R2 D' L2 F2 U' B2 D2 L' F' U R2 B L' D' R U' F2 Fw' Uw", date: '2026-09-24T21:34:21', memo: memoA },
{ id: 's6', index: 6, time: 81440, memoTime: 31660, penalty: 'ok', scramble: "U' L2 D2 F2 R2 U R2 B2 D' L F2 U' R' D B' L2 F' R2 Rw2 Uw'", date: '2026-09-24T21:29:48', memo: memoB },
{ id: 's5', index: 5, time: 59920, memoTime: 24180, penalty: 'ok', scramble: "R' D2 B2 L2 U' F2 D B2 R2 U2 F L' B U' R D F2 L' U2 Fw", date: '2026-09-24T21:25:30', memo: memoC },
{ id: 's4', index: 4, time: 76350, memoTime: 30020, penalty: 'ok', scramble: "F' L2 U B2 D' R2 D' L2 F2 U B' R' F D2 L' B2 U' R B' Rw Uw", date: '2026-09-24T21:21:07', memo: memoA },
{ id: 's3', index: 3, time: 87400, memoTime: 36710, penalty: 'ok', scramble: "D' B2 U2 R2 F2 D L2 U' B2 R F' D' R2 B L U' F' L2 D2 Fw Uw'", date: '2026-09-24T21:16:44', memo: memoCEarly },
{ id: 's2', index: 2, time: 71860, memoTime: 27950, penalty: 'ok', scramble: "L2 F2 D' U2 B2 R2 U' F2 L' D B' R' U F2 L D2 B' R' Fw Uw2", date: '2026-09-24T21:12:19', memo: memoB },
{ id: 's1', index: 1, time: 95170, memoTime: 38440, penalty: 'ok', scramble: "U2 R2 F' D2 B' L2 F U2 R2 B2 L' D' F' R U' B R2 D F' Rw' Uw", date: '2026-09-24T21:07:02', memo: memoCEarly }];