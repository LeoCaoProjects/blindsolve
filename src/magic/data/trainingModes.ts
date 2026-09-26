export type TrainMode = 'recall' | 'trace' | 'full' | 'exec';

export interface TrainingModeInfo {
  id: TrainMode;
  label: string;
  /** One sentence shown while idle */
  line: string;
  /** What the drill practises, shown under the title in its help sheet */
  tests: string;
  steps: string[];
}

export const trainingModes: TrainingModeInfo[] = [
{
  id: 'recall',
  label: 'Memo Recall',
  line: 'Memorise the letters, then type them back from memory.',
  tests: 'Practises remembering a memo.',
  steps: [
  'Hold Space and release to start',
  'Memorise the letters on screen',
  'Press Space when you have them',
  'Type them back and press Enter']

},
{
  id: 'trace',
  label: 'Trace Sprint',
  line: 'Trace the cube and type the targets as fast as you can.',
  tests: 'Practises reading a cube into targets.',
  steps: [
  'Hold Space and release to start',
  'The right cube is the back of the left one',
  'Type your targets, starting from your buffers',
  'Press Enter to submit']

},
{
  id: 'full',
  label: 'Full Memo',
  line: 'Trace the cube and write your memo as words.',
  tests: 'Practises turning a cube into your words.',
  steps: [
  'Hold Space and release to start',
  'Type the word for each pair and press Enter after each one',
  'Press Enter on an empty field to submit',
  'Words that don’t match your list are marked wrong']

},
{
  id: 'exec',
  label: 'Execution Sprint',
  line: 'Scramble your cube, then solve it blind while reading the memo on screen.',
  tests: 'Practises execution only. The memo is given to you.',
  steps: [
  'Apply the scramble to your cube. Take your time',
  'Hold Space and release. The memo appears and the clock starts',
  'Solve without looking at the cube',
  'Press Space to stop, then mark it Solved or DNF']

}];


export const modeInfo = (id: TrainMode) => trainingModes.find((m) => m.id === id) as TrainingModeInfo;