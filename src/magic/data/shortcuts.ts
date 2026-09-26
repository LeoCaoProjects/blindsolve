export interface ShortcutItem {
  keys: string[];
  label: string;
}

export interface ShortcutSection {
  id: string;
  title: string;
  items: ShortcutItem[];
}

export const shortcuts: ShortcutItem[] = [
{ keys: ['Space'], label: 'Hold, release to start' },
{ keys: ['Space'], label: 'End memo, then stop' },
{ keys: ['N'], label: 'New scramble' },
{ keys: ['1', '2', '3'], label: 'OK · +2 · DNF' },
{ keys: ['A–X'], label: 'Pick cycle-break sticker' },
{ keys: ['↵'], label: 'Continue / save' },
{ keys: ['Esc'], label: 'Close · save without questions' },
{ keys: ['?'], label: 'This sheet' }];


export const shortcutSections: ShortcutSection[] = [
{ id: 'timer', title: 'Timer', items: shortcuts },
{
  id: 'pairs',
  title: 'Letter Pairs',
  items: [
  { keys: ['↑', '↓'], label: 'Move through pairs' },
  { keys: ['←', '→'], label: 'Jump between groups' },
  { keys: ['[', ']'], label: 'Previous · next first letter' },
  { keys: ['T', 'W'], label: 'Type a pair to jump' },
  { keys: ['↵'], label: 'Edit pair' },
  { keys: ['Esc'], label: 'Close editor' }]

},
{
  id: 'flashcards',
  title: 'Flashcards',
  items: [
  { keys: ['Space'], label: 'Reveal' },
  { keys: ['↵'], label: 'Remembered' },
  { keys: ['F'], label: 'Forgot' },
  { keys: ['E'], label: 'Edit mnemonic' },
  { keys: ['A'], label: 'Add alternate' }]

},
{
  id: 'training',
  title: 'Training',
  items: [
  { keys: ['Space'], label: 'Hold, release to start' },
  { keys: ['Space'], label: 'Memo Recall: done studying' },
  { keys: ['↵'], label: 'Next group · submit · next' },
  { keys: ['⌫'], label: 'Full Memo: edit previous word' },
  { keys: ['Esc'], label: 'Show the answer' }]

}];