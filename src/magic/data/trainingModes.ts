export type TrainMode = 'recall' | 'trace' | 'exec' | 'guided';
/** Persisted by older releases. It is intentionally not an active Training mode. */
export type LegacyTrainMode = 'full';

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
  id: 'exec',
  label: 'Execution Sprint',
  line: 'Scramble your cube, then solve it blind while reading the memo on screen.',
  tests: 'Practises execution only. The memo is given to you.',
  steps: [
  'Apply the scramble to your cube. Take your time',
  'Hold Space and release. The memo appears and the clock starts',
  'Solve without looking at the cube',
  'Press Space to stop, then mark it Solved or DNF']

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
  id: 'guided',
  label: 'Guided Solve',
  line: 'Memorise a generated solve, then execute it blind.',
  tests: 'Practises a complete blind solve with the tracing done for you.',
  steps: [
  'Apply the scramble, then hold Space and release',
  'Memorise the generated letter pairs',
  'Press Space to hide the memo and begin execution',
  'Press Space to stop, then mark it Solved or DNF']

}];


export const modeInfo = (id: TrainMode) => trainingModes.find((m) => m.id === id) as TrainingModeInfo;
