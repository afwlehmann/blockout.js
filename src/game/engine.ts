import type { MatchConfig, PieceOrientations, PieceDef, Vec3, Axis, Direction } from "./types.js";
import { Pit, type LockResult } from "./pit.js";
import { Rng } from "./rng.js";
import { buildPieces } from "./pieces.js";
import { piecesForSet } from "./registry.js";

export type { Axis, Direction } from "./types.js";

export type PlayerAction =
  | { readonly kind: "move"; readonly dx: number; readonly dz: number }
  | { readonly kind: "rotate"; readonly axis: Axis; readonly dir: Direction }
  | { readonly kind: "softDrop" }
  | { readonly kind: "hardDrop" }
  | { readonly kind: "ghost" }
  | { readonly kind: "pause" };

export interface ActivePiece {
  readonly def: PieceDef;
  readonly orientationIndex: number;
  readonly origin: Vec3;
}

export interface EngineEvent {
  readonly type:
    | "lock"
    | "clear"
    | "blockOut"
    | "gameOver"
    | "levelUp"
    | "spawn"
    | "move"
    | "rotate";
  readonly clearedLayers?: readonly number[];
  readonly blockOut?: boolean;
  readonly level?: number;
  readonly preClearGrid?: readonly number[];
  readonly dropDistance?: number;
}

export interface EngineState {
  readonly score: number;
  readonly level: number;
  readonly faces: number;
  readonly cubes: number;
  readonly active: ActivePiece | null;
  readonly next: PieceDef;
  readonly gameOver: boolean;
  readonly paused: boolean;
  readonly elapsedMs: number;
}

const GRAVITY_BASE_MS = 800;
const GRAVITY_MIN_MS = 50;
const GRAVITY_STEP_MS = 50;
const LEVEL_FACES_PER_LEVEL = 10;
const ALL_CLEAR_BONUS = 10000;
const SCORE_PER_LAYER: readonly number[] = [0, 100, 300, 600, 1000, 1500];
const MAX_SCORE_TIER = 5;

const scoreFor = (layers: number, level: number): number => {
  const base = SCORE_PER_LAYER[Math.min(layers, MAX_SCORE_TIER)] ?? 1500;
  return base * level;
};

const rotateIndex = (
  transitions: readonly (readonly number[])[],
  current: number,
  axis: Axis,
  dir: Direction,
): number => {
  const row = transitions[current];
  if (!row) return current;
  const col =
    axis === "x" ? (dir === 1 ? 0 : 1) : axis === "y" ? (dir === 1 ? 2 : 3) : dir === 1 ? 4 : 5;
  return row[col] ?? current;
};

export class PlayerEngine {
  readonly pit: Pit;
  readonly config: MatchConfig;
  private rng: Rng;
  private pieces: PieceOrientations[];
  private bag: PieceDef[] = [];
  private active: ActivePiece | null = null;
  private nextPiece: PieceDef;
  private score = 0;
  private level: number;
  private faces = 0;
  private cubes = 0;
  private elapsedMs = 0;
  private gravityAccumulatorMs = 0;
  private gameOver = false;
  private paused = false;
  private listeners: ((e: EngineEvent) => void)[] = [];

  constructor(config: MatchConfig, rng: Rng) {
    this.config = config;
    this.rng = rng;
    this.pit = new Pit(config.pit);
    this.pieces = buildPieces(piecesForSet(config.set));
    this.level = config.startLevel;
    this.nextPiece = this.draw();
    this.spawn();
  }

  on(listener: (e: EngineEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(e: EngineEvent): void {
    this.listeners.forEach((l) => {
      l(e);
    });
  }

  private draw(): PieceDef {
    if (this.bag.length === 0) {
      this.bag = [...piecesForSet(this.config.set)];
    }
    const idx = this.rng.int(this.bag.length);
    const piece = this.bag[idx];
    if (!piece) throw new Error("empty bag");
    this.bag = this.bag.filter((_, i) => i !== idx);
    return piece;
  }

  private pieceOrientations(def: PieceDef): PieceOrientations {
    const found = this.pieces.find((p) => p.def.id === def.id);
    if (!found) throw new Error(`no orientations for ${def.id}`);
    return found;
  }

  activeCells(): readonly Vec3[] {
    const current = this.active;
    if (!current) return [];
    const orientations = this.pieceOrientations(current.def).orientations;
    return orientations[current.orientationIndex]?.cells ?? [];
  }

  private spawn(): void {
    const def = this.nextPiece;
    this.nextPiece = this.draw();
    const orientations = this.pieceOrientations(def).orientations;
    const origin: Vec3 = {
      x: Math.floor((this.config.pit.width - 1) / 2),
      y: this.config.pit.height - 1,
      z: Math.floor((this.config.pit.depth - 1) / 2),
    };
    const piece: ActivePiece = {
      def,
      orientationIndex: 0,
      origin,
    };
    if (this.pit.collides(origin, orientations[0]?.cells ?? [])) {
      this.gameOver = true;
      this.emit({ type: "gameOver" });
      this.active = null;
      return;
    }
    this.active = piece;
    this.emit({ type: "spawn" });
  }

  state(): EngineState {
    return {
      score: this.score,
      level: this.level,
      faces: this.faces,
      cubes: this.cubes,
      active: this.active,
      next: this.nextPiece,
      gameOver: this.gameOver,
      paused: this.paused,
      elapsedMs: this.elapsedMs,
    };
  }

  private gravityMs(): number {
    return Math.max(GRAVITY_MIN_MS, GRAVITY_BASE_MS - (this.level - 1) * GRAVITY_STEP_MS);
  }

  update(deltaMs: number): readonly EngineEvent[] {
    if (this.gameOver || this.paused) return [];
    this.elapsedMs += deltaMs;
    this.gravityAccumulatorMs += deltaMs;
    const tick = this.gravityMs();
    const ticks = Math.floor(this.gravityAccumulatorMs / tick);
    if (ticks === 0) return [];
    this.gravityAccumulatorMs -= ticks * tick;
    const events: EngineEvent[] = [];
    Array.from({ length: ticks }).forEach(() => {
      if (this.gameOver || !this.active) return;
      const moved = this.tryMove(0, -1, 0);
      if (!moved) {
        const lockEvents = this.lockActive();
        events.push(...lockEvents);
      }
    });
    events.forEach((e) => {
      this.emit(e);
    });
    return events;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  applyAction(action: PlayerAction): readonly EngineEvent[] {
    if (action.kind === "pause") {
      if (this.gameOver) return [];
      this.paused = !this.paused;
      return [];
    }
    if (this.gameOver || this.paused) return [];
    switch (action.kind) {
      case "move": {
        const moved = this.tryMove(action.dx, 0, action.dz);
        if (moved) {
          const ev: EngineEvent = { type: "move" };
          this.emit(ev);
          return [ev];
        }
        return [];
      }
      case "rotate": {
        const rotated = this.tryRotate(action.axis, action.dir);
        if (rotated) {
          const ev: EngineEvent = { type: "rotate" };
          this.emit(ev);
          return [ev];
        }
        return [];
      }
      case "softDrop": {
        const moved = this.tryMove(0, -1, 0);
        if (moved) {
          const ev: EngineEvent = { type: "move" };
          this.emit(ev);
          return [ev];
        }
        return [];
      }
      case "hardDrop": {
        const events = this.hardDrop();
        events.forEach((e) => {
          this.emit(e);
        });
        return events;
      }
      case "ghost":
        return [];
      default:
        return [];
    }
  }

  private tryMove(dx: number, dy: number, dz: number): boolean {
    if (!this.active) return false;
    const orientations = this.pieceOrientations(this.active.def).orientations;
    const cells = orientations[this.active.orientationIndex]?.cells ?? [];
    const next: Vec3 = {
      x: this.active.origin.x + dx,
      y: this.active.origin.y + dy,
      z: this.active.origin.z + dz,
    };
    if (this.pit.collides(next, cells)) return false;
    this.active = { ...this.active, origin: next };
    return true;
  }

  private tryRotate(axis: Axis, dir: Direction): boolean {
    const current = this.active;
    if (!current) return false;
    const po = this.pieceOrientations(current.def);
    const orientations = po.orientations;
    if (orientations.length <= 1) return false;
    const nextIdx = rotateIndex(po.transitions, current.orientationIndex, axis, dir);
    if (nextIdx === current.orientationIndex) return false;
    const cells = orientations[nextIdx]?.cells ?? [];
    const kicks = [
      { x: 0, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: -1 },
      { x: 0, y: 0, z: 1 },
      { x: -2, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 0, y: 0, z: -2 },
      { x: 0, y: 0, z: 2 },
    ];
    const placed = kicks.find((k) => {
      const next: Vec3 = {
        x: current.origin.x + k.x,
        y: current.origin.y + k.y,
        z: current.origin.z + k.z,
      };
      return !this.pit.collides(next, cells);
    });
    if (!placed) return false;
    this.active = {
      ...current,
      orientationIndex: nextIdx,
      origin: {
        x: current.origin.x + placed.x,
        y: current.origin.y + placed.y,
        z: current.origin.z + placed.z,
      },
    };
    return true;
  }

  private hardDrop(): readonly EngineEvent[] {
    if (!this.active) return [];
    const startY = this.active.origin.y;
    Array.from({ length: this.config.pit.height + 1 }).forEach(() => {
      this.tryMove(0, -1, 0);
    });
    const dropDistance = startY - this.active.origin.y;
    return this.lockActive(dropDistance);
  }

  private lockActive(dropDistance = 0): readonly EngineEvent[] {
    if (!this.active) return [];
    const orientations = this.pieceOrientations(this.active.def).orientations;
    const cells = orientations[this.active.orientationIndex]?.cells ?? [];
    const preClearGrid = this.pit.snapshot();
    const lockResult: LockResult = this.pit.lock(this.active.origin, cells, this.active.def.color);
    this.cubes += cells.length;
    this.active = null;
    const events: EngineEvent[] = [{ type: "lock", dropDistance }];
    if (lockResult.clearedLayers.length > 0) {
      this.faces += lockResult.clearedLayers.length;
      this.score += scoreFor(lockResult.clearedLayers.length, this.level);
      events.push({
        type: "clear",
        clearedLayers: lockResult.clearedLayers,
        preClearGrid,
      });
      const newLevel = this.startLevel + Math.floor(this.faces / LEVEL_FACES_PER_LEVEL);
      if (newLevel > this.level) {
        this.level = newLevel;
        events.push({ type: "levelUp", level: newLevel });
      }
    }
    if (lockResult.blockOut) {
      this.score += ALL_CLEAR_BONUS;
      events.push({ type: "blockOut", blockOut: true });
    }
    if (lockResult.overflowed) {
      this.gameOver = true;
      events.push({ type: "gameOver" });
      return events;
    }
    this.spawn();
    return events;
  }

  get startLevel(): number {
    return this.config.startLevel;
  }

  ghostOrigin(): Vec3 | null {
    const current = this.active;
    if (!current) return null;
    const orientations = this.pieceOrientations(current.def).orientations;
    const cells = orientations[current.orientationIndex]?.cells ?? [];
    const floor = -cells.length;
    const dropSteps = Array.from(
      { length: current.origin.y - floor + 1 },
      (_, i) => current.origin.y - i,
    );
    const resting = dropSteps.find((y) =>
      this.pit.collides({ ...current.origin, y: y - 1 }, cells),
    );
    const y = resting ?? floor;
    return { ...current.origin, y };
  }
}
