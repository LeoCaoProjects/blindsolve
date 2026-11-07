export type TrainMode = "recall" | "trace" | "exec" | "guided";
/** Persisted by older releases. It is intentionally not an active Training mode. */
export type LegacyTrainMode = "full";

export interface TrainingModeInfo {
  id: TrainMode;
  label: string;
  /** One sentence shown while idle */
  line: string;
  /** What the drill practises, shown under the title in its help sheet */
  tests: string;
  steps: { label: string; text: string }[];
}

export const trainingModes: TrainingModeInfo[] = [
  {
    id: "exec",
    label: "Execution Sprint",
    line: "Scramble your cube, then solve it blind while reading the memo on screen.",
    tests: "Practise execution with the memo supplied.",
    steps: [
      { label: "Prepare", text: "Apply the scramble to your cube." },
      {
        label: "Start",
        text: "Hold Space until ready, then release. The targets appear and timing starts.",
      },
      {
        label: "Execute",
        text: "Solve from the letter pairs or saved words without looking at your physical cube.",
      },
      {
        label: "Finish",
        text: "Press Space to stop. Choose Solved or DNF in the result.",
      },
    ],
  },
  {
    id: "guided",
    label: "Guided Solve",
    line: "Memorise a generated solve, then execute it blind.",
    tests: "Memorise the supplied targets, then solve your cube blind.",
    steps: [
      { label: "Prepare", text: "Apply the scramble to your cube." },
      {
        label: "Memorise",
        text: "Hold Space until ready, then release. Study the letter pairs.",
      },
      {
        label: "Execute",
        text: "Press Space to hide the memo and begin execution.",
      },
      {
        label: "Finish",
        text: "Press Space to stop. Choose OK or DNF, then close the result.",
      },
    ],
  },
  {
    id: "recall",
    label: "Memo Recall",
    line: "Memorise the letters, then type them back from memory.",
    tests: "Study the targets, then recall them from memory.",
    steps: [
      {
        label: "Study",
        text: "Hold Space until ready, then release. Memorise the letters.",
      },
      {
        label: "Recall",
        text: "Press Space to hide the memo. Type the targets in order.",
      },
      {
        label: "Check",
        text: "Press Enter for the next field or to check the last field. Esc reveals the answer.",
      },
    ],
  },
  {
    id: "trace",
    label: "Trace Sprint",
    line: "Scramble your cube, then trace it or the virtual cubes and type the targets.",
    tests:
      "Practise tracing with your physical cube or the matching virtual cubes.",
    steps: [
      {
        label: "Prepare",
        text: "Apply the displayed scramble to your physical cube, or use the virtual cubes when timing starts. Do not inspect the pieces before starting.",
      },
      {
        label: "Start",
        text: "Hold Space until ready, then release. Timing starts and the virtual cubes appear; the scramble stays the same.",
      },
      {
        label: "Trace",
        text: "Trace your physical cube or either virtual view from the buffer and type the targets. Both virtual views show the same scrambled cube; the right view shows its back. At a cycle break, choose any sticker on an unsolved non-buffer piece and continue tracing from it.",
      },
      {
        label: "Check",
        text: "Type the targets in order. Press Enter for the next field or to submit the last field.",
      },
    ],
  },
];

export const modeInfo = (id: TrainMode) =>
  trainingModes.find((m) => m.id === id) as TrainingModeInfo;
