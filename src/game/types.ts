export type PlayerId = 1 | 2;

export type PieceSet = "flat" | "basic" | "extended";

export type Difficulty = "easy" | "normal" | "hard";

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface PitConfig {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

export interface MatchConfig {
  readonly mode: "1p" | "2p";
  readonly pit: PitConfig;
  readonly set: PieceSet;
  readonly startLevel: number;
  readonly targetFaces: number;
  readonly difficulty: Difficulty;
}

export interface PieceDef {
  readonly id: string;
  readonly set: PieceSet;
  readonly color: number;
  readonly cells: readonly Vec3[];
}

export type Axis = "x" | "y" | "z";
export type Direction = 1 | -1;

export interface Orientation {
  readonly cells: readonly Vec3[];
  readonly key: string;
}

export interface PieceOrientations {
  readonly def: PieceDef;
  readonly orientations: readonly Orientation[];
  readonly transitions: readonly (readonly number[])[];
}

export interface Settings {
  readonly soundEnabled: boolean;
  readonly musicEnabled: boolean;
  readonly keyLayouts: Readonly<Record<PlayerId, Readonly<Record<string, string>>>>;
  readonly lastConfig: MatchConfig | null;
}
