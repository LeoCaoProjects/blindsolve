export type PieceType = "edge" | "corner";

export interface StickerDefinition {
  id: string;
  pieceType: PieceType;
  pieceIndex: number;
  orientationIndex: number;
  face: string;
  label: string;
}

export interface LetteringScheme {
  id: string;
  name: string;
  orientation: { up: string; front: string };
  edgeBuffer: string;
  cornerBuffer: string;
  edgeMethod: "raw" | "m2" | "old-pochmann" | "3style";
  cornerMethod: "raw" | "old-pochmann" | "3style";
  stickers: Record<string, StickerDefinition>;
}

export interface OrbitState {
  pieces: number[];
  orientation: number[];
}

export interface CubeOrbitState {
  EDGES: OrbitState;
  CORNERS: OrbitState;
}

export interface TraceTarget {
  stickerId: string;
  pieceIndex: number;
  token: string;
  cycleBreak: boolean;
}

export interface TraceSection {
  pieceType: PieceType;
  status: "complete" | "cycle-break";
  targets: TraceTarget[];
  visitedPieces: number[];
  validCycleBreaks: string[];
}

export interface MemoTrace {
  edges: TraceSection;
  corners: TraceSection;
}
