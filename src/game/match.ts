import type { MatchConfig, PlayerId } from "./types.js";
import { PlayerEngine, type EngineEvent } from "./engine.js";
import { Rng } from "./rng.js";

export type MatchPhase = "playing" | "finished";

export interface MatchResult {
  readonly winner: PlayerId | null;
  readonly reason: "faces" | "ko" | "draw";
}

export interface MatchState {
  readonly phase: MatchPhase;
  readonly result: MatchResult | null;
  readonly engines: Readonly<Record<PlayerId, PlayerEngine>>;
}

export type MatchEvent =
  | { readonly type: "attack"; readonly from: PlayerId; readonly layers: number }
  | { readonly type: "finish"; readonly result: MatchResult }
  | { readonly type: "engine"; readonly player: PlayerId; readonly event: EngineEvent };

const PLAYERS: readonly PlayerId[] = [1, 2];

export class Match {
  readonly config: MatchConfig;
  readonly engines: Readonly<Record<PlayerId, PlayerEngine>>;
  private phase: MatchPhase = "playing";
  private result: MatchResult | null = null;
  private listeners: ((e: MatchEvent) => void)[] = [];

  constructor(config: MatchConfig, seed: number) {
    this.config = config;
    this.engines = {
      1: new PlayerEngine(config, new Rng(seed)),
      2: new PlayerEngine(config, new Rng(seed)),
    };
    PLAYERS.forEach((p) => {
      this.engines[p].on((ev) => {
        this.handleEngineEvent(p, ev);
      });
    });
  }

  on(listener: (e: MatchEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(e: MatchEvent): void {
    this.listeners.forEach((l) => {
      l(e);
    });
  }

  private handleEngineEvent(player: PlayerId, ev: EngineEvent): void {
    if (ev.type === "clear" && ev.clearedLayers && ev.clearedLayers.length > 0) {
      const layers = ev.clearedLayers.length;
      const opponent: PlayerId = player === 1 ? 2 : 1;
      const raiseResult = this.engines[opponent].pit.raiseStack(layers);
      this.emit({ type: "attack", from: player, layers });
      if (raiseResult.overflowed) {
        this.finish({ winner: player, reason: "ko" });
      }
    }
    if (ev.type === "gameOver") {
      const opponent: PlayerId = player === 1 ? 2 : 1;
      this.finish({ winner: opponent, reason: "ko" });
    }
    this.emit({ type: "engine", player, event: ev });
    this.checkFacesWin();
  }

  private checkFacesWin(): void {
    if (this.phase !== "playing") return;
    const winners = PLAYERS.filter((p) => this.engines[p].state().faces >= this.config.targetFaces);
    if (winners.length === 1) {
      this.finish({ winner: winners[0] ?? null, reason: "faces" });
    } else if (winners.length === 2) {
      this.finish({ winner: null, reason: "draw" });
    }
  }

  private finish(result: MatchResult): void {
    if (this.phase !== "playing") return;
    this.phase = "finished";
    this.result = result;
    this.emit({ type: "finish", result });
  }

  state(): MatchState {
    return {
      phase: this.phase,
      result: this.result,
      engines: this.engines,
    };
  }

  applyAction(player: PlayerId, action: Parameters<PlayerEngine["applyAction"]>[0]): void {
    if (this.phase !== "playing") return;
    this.engines[player].applyAction(action);
  }

  update(deltaMs: number): void {
    if (this.phase !== "playing") return;
    PLAYERS.forEach((p) => {
      this.engines[p].update(deltaMs);
    });
  }
}
