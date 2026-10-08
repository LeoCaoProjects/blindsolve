export type Penalty = "ok" | "+2" | "dnf";
export type Piece = "corners" | "edges";

export interface MemoPair {
  pair: string;
  word: string;
}

export interface SolveMemo {
  corners: MemoPair[];
  edges: MemoPair[];
  /** Flat letter index where a new cycle began */
  cornerBreakAt?: number;
  edgeBreakAt?: number;
  m2Parity?: boolean;
}

export interface Solve {
  id: string;
  index: number;
  time: number;
  memoTime?: number;
  penalty: Penalty;
  scramble: string;
  date: string;
  memo: SolveMemo;
}

export interface CycleBreak {
  at: number;
  options: string[];
  answer: string;
}

export interface MemoSample {
  corners: string[];
  edges: string[];
  cornerBreak?: CycleBreak;
  edgeBreak?: CycleBreak;
  m2Parity?: boolean;
}

export interface SolveDraft {
  solveId?: string;
  time: number;
  memoTime?: number;
  scramble: string;
  date: string;
  sample: MemoSample;
  engine?: {
    state: import("../../domain/bld/types").CubeOrbitState;
    scheme: import("../../domain/bld/types").LetteringScheme;
  };
  memoPrefs?: {
    m2SecondTargetSwap: boolean;
    memoOrder: "corners-first" | "edges-first";
  };
}

export type LetterPairDb = Record<string, string[]>;

export type DemoStage =
  "live" | "running" | "stopped" | "reconstruction" | "details";

export interface ConceptProps {
  multiphase: boolean;
  stage: DemoStage;
}

export interface SessionStats {
  best: string;
  mo3: string;
  success: string;
  count: number;
}
