import { MemoSample } from '../types/solve';

/** Deterministic memo traces the app derives after each live solve (rotated per solve). */
export const memoSamples: MemoSample[] = [
{
  corners: ['WC', 'RM', 'JH', 'TS', 'LG'],
  edges: ['AR', 'CO', 'DF', 'JV', 'TX', 'UX'],
  cornerBreak: { at: 4, options: ['J', 'L', 'P', 'O'], answer: 'J' },
  edgeBreak: { at: 4, options: ['D', 'J', 'L', 'N'], answer: 'D' }
},
{
  corners: ['BQ', 'NF', 'KW', 'HP'],
  edges: ['MI', 'SE', 'KG', 'PB', 'WL'],
  edgeBreak: { at: 4, options: ['K', 'B', 'O', 'C'], answer: 'K' }
},
{
  corners: ['UF', 'DM', 'SI', 'OJ'],
  edges: ['QN', 'CB', 'LH', 'VR', 'EK', 'TG']
}];