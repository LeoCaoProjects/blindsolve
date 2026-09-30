export type PairScope = "shared" | "edges" | "corners";
export type Sharing = "shared" | "separate";

/** Words are ordered: primary first, then alternates. Overrides only exist when set. */
export interface PairEntry {
  shared: string[];
  edges?: string[];
  corners?: string[];
}

/** Keyed by `${first}|${second}` so multi-character tokens stay unambiguous. */
export type PairDb = Record<string, PairEntry>;

export type LetterScheme = Record<string, string>;

export type FaceColor =
  "white" | "yellow" | "green" | "blue" | "red" | "orange";

/**
 * How a rendered cube initially faces the user. Presentation only:
 * scrambles, cube state, tracing and lettering always use white top, green front.
 */
export interface CubeViewPref {
  top: FaceColor;
  front: FaceColor;
}

export type EdgeMethod = "m2" | "op" | "3style";
export type CornerMethod = "op" | "3style";
export type OrientationHandling = "cycle" | "separate";

export interface BldSetup {
  scheme: LetterScheme;
  schemeName: string;
  edgeBuffer: string;
  cornerBuffer: string;
  edgeMethod: EdgeMethod;
  cornerMethod: CornerMethod;
  flippedEdges: OrientationHandling;
  twistedCorners: OrientationHandling;
}

export interface Prefs {
  sharing: Sharing;
  multiphase: boolean;
  showLiveTimer: boolean;
  defaultView: CubeViewPref;
}

export type SyncStatus =
  | "local"
  | "unconfigured"
  | "idle"
  | "saving"
  | "offline"
  | "failed"
  | "conflict";
export type AuthProvider = "wca" | "google";

export interface Account {
  provider: AuthProvider | null;
  name: string;
  /** WCA ID for WCA accounts, email for Google */
  detail: string;
  status: SyncStatus;
  lastAttemptAt?: string | null;
  /** Granted by the database; never inferred from frontend identity fields. */
  role?: "user" | "admin";
}

export type CubeMode =
  "view" | "lettering" | "edge-buffer" | "corner-buffer" | "cube-view";
