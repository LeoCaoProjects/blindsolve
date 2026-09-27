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
{ keys: ['⌫'], label: 'Delete latest solve' },
{ keys: ['⇧', '⌫'], label: 'Clear this session' },
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
  { keys: ['A'], label: 'Add alternate' },
  { keys: ['⌫'], label: 'Remove latest card from history' },
  { keys: ['⇧', '⌫'], label: 'Clear history' }]

},
{
  id: 'training',
  title: 'Training',
  items: [
  { keys: ['Space'], label: 'Hold, release to start' },
  { keys: ['Space'], label: 'Memo Recall: done studying' },
  { keys: ['Space'], label: 'Execution Sprint: stop' },
  { keys: ['S', 'D'], label: 'Execution Sprint: Solved · DNF' },
  { keys: ['↵'], label: 'Next field · submit · next' },
  { keys: ['⌫'], label: 'Full Memo: edit previous word' },
  { keys: ['Esc'], label: 'Show the answer · cancel edits' },
  { keys: ['N'], label: 'Execution Sprint: new scramble' },
  { keys: ['⌫'], label: 'Delete latest attempt' },
  { keys: ['⇧', '⌫'], label: 'Clear this drill’s attempts' }]

}];