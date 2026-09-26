export type SuggestionKind = 'object' | 'person' | 'character' | 'animal' | 'action' | 'place' | 'food' | 'brand' | 'sound';

export interface Suggestion {
  word: string;
  kind: SuggestionKind;
}

export const curatedSuggestions: Record<string, Suggestion[]> = {
  JV: [
  { word: 'Java', kind: 'place' },
  { word: 'javelin', kind: 'object' },
  { word: 'Juventus', kind: 'brand' },
  { word: 'jive', kind: 'action' },
  { word: 'JVC camcorder', kind: 'brand' },
  { word: 'Jon Bon Jovi', kind: 'person' },
  { word: 'jelly volcano', kind: 'object' },
  { word: 'jovial Santa', kind: 'character' },
  { word: 'jav-uh', kind: 'sound' },
  { word: 'jungle vine', kind: 'object' }],

  TX: [
  { word: 'Texas', kind: 'place' },
  { word: 'tax form', kind: 'object' },
  { word: 'tuxedo', kind: 'object' },
  { word: 'T. rex', kind: 'animal' },
  { word: 'taxi', kind: 'object' },
  { word: 'Tex-Mex taco', kind: 'food' },
  { word: 'toxic barrel', kind: 'object' },
  { word: 'Texas Ranger', kind: 'character' },
  { word: 'text message', kind: 'action' },
  { word: 'tacks', kind: 'object' }],

  NB: [
  { word: 'NBA ball', kind: 'object' },
  { word: 'nibbling', kind: 'action' },
  { word: 'New Balance', kind: 'brand' },
  { word: 'nebula', kind: 'place' },
  { word: 'knob', kind: 'object' },
  { word: 'nabob', kind: 'person' }],

  QK: [
  { word: 'quack', kind: 'sound' },
  { word: 'quokka', kind: 'animal' },
  { word: 'quicksand', kind: 'place' },
  { word: 'quake', kind: 'action' },
  { word: 'quarterback', kind: 'person' },
  { word: 'Quaker Oats', kind: 'brand' },
  { word: 'quick draw', kind: 'action' }],

  GJ: [
  { word: 'gin & juice', kind: 'food' },
  { word: 'gyro jet', kind: 'object' },
  { word: 'Gru & minions', kind: 'character' },
  { word: 'goji berries', kind: 'food' },
  { word: 'G.I. Joe', kind: 'character' },
  { word: 'garage jack', kind: 'object' }],

  XE: [
  { word: 'Xena', kind: 'character' },
  { word: 'xenomorph', kind: 'character' },
  { word: 'Xerox machine', kind: 'brand' },
  { word: 'X-Men', kind: 'character' },
  { word: 'exercise bike', kind: 'object' }],

  PW: [
  { word: 'paw', kind: 'animal' },
  { word: 'power drill', kind: 'object' },
  { word: 'pew', kind: 'sound' },
  { word: 'PlayStation Wii', kind: 'brand' },
  { word: 'Paw Patrol', kind: 'character' },
  { word: 'powder puff', kind: 'object' }],

  NS: [
  { word: 'NASA rocket', kind: 'brand' },
  { word: 'nose', kind: 'object' },
  { word: 'Nintendo Switch', kind: 'brand' },
  { word: 'noose', kind: 'object' },
  { word: 'nest', kind: 'animal' },
  { word: 'Nessie', kind: 'character' }],

  RV: [
  { word: 'RV camper', kind: 'object' },
  { word: 'raven', kind: 'animal' },
  { word: 'river', kind: 'place' },
  { word: 'revolver', kind: 'object' },
  { word: 'Ravioli', kind: 'food' },
  { word: 'rave', kind: 'action' }],

  SU: [
  { word: 'sumo wrestler', kind: 'person' },
  { word: 'sushi', kind: 'food' },
  { word: 'suit', kind: 'object' },
  { word: 'Superman', kind: 'character' },
  { word: 'submarine', kind: 'object' },
  { word: 'sun', kind: 'object' },
  { word: 'Suzuki', kind: 'brand' }],

  VK: [
  { word: 'Viking', kind: 'person' },
  { word: 'vodka', kind: 'food' },
  { word: 'vacuum', kind: 'object' },
  { word: 'volcano kettle', kind: 'object' },
  { word: 'VK (vodka kick)', kind: 'food' }],

  IH: [
  { word: 'IHOP pancakes', kind: 'brand' },
  { word: 'ice hockey', kind: 'action' },
  { word: 'Iron Hulk', kind: 'character' },
  { word: 'inhaler', kind: 'object' }]

};

export const fallbackWords: Suggestion[] = [
'anchor', 'arrow', 'badger', 'balloon', 'bandit', 'basket', 'beaver', 'bishop', 'blender', 'bottle', 'bridge', 'bucket',
'cactus', 'candle', 'carrot', 'castle', 'cobra', 'comet', 'cookie', 'crab', 'dagger', 'desert', 'diamond', 'dragon',
'drum', 'eclipse', 'egret', 'emerald', 'envelope', 'falcon', 'feather', 'ferret', 'flute', 'fridge', 'galaxy',
'garlic', 'geyser', 'giraffe', 'goblin', 'gorilla', 'hammer', 'harp', 'helmet', 'hermit', 'hornet', 'igloo', 'iguana',
'island', 'ivory', 'jaguar', 'jester', 'jigsaw', 'juggler', 'kayak', 'kettle', 'kiosk', 'knuckle', 'lantern', 'lizard',
'lobster', 'magnet', 'marble', 'mitten', 'monkey', 'needle', 'noodle', 'nugget', 'nutmeg', 'oyster', 'otter', 'onion',
'parrot', 'pepper', 'pickle', 'pillow', 'puppet', 'quartz', 'quiver', 'rocket', 'rhino', 'ribbon', 'saddle', 'salmon',
'scarf', 'shovel', 'spider', 'statue', 'tablet', 'tiger', 'trumpet', 'turtle', 'umbrella', 'urchin', 'vampire', 'velvet',
'viper', 'vulture', 'walrus', 'wizard', 'whistle', 'yacht', 'zebra', 'zipper', 'quilt', 'squid', 'sphinx', 'waffle',
'wax', 'vortex', 'taxi', 'boxer', 'mixer', 'toaster', 'twister', 'pretzel', 'jukebox', 'hexagon', 'oxygen', 'fax'].
map((word) => ({ word, kind: 'object' as const }));

export const SUGGESTION_KIND_LABEL: Record<SuggestionKind, string> = {
  object: 'object',
  person: 'person',
  character: 'character',
  animal: 'animal',
  action: 'action',
  place: 'place',
  food: 'food',
  brand: 'brand',
  sound: 'sound'
};