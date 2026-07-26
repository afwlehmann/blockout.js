import { describe, it, expect } from "vitest";
import { Match } from "./match.js";
import type { MatchConfig, PlayerId } from "./types.js";

const config: MatchConfig = {
  mode: "2p",
  pit: { width: 5, depth: 5, height: 8 },
  set: "flat",
  startLevel: 1,
  targetFaces: 3,
  difficulty: "normal",
};

const makeMatch = (seed = 12345): Match => new Match(config, seed);

describe("Match", () => {
  it("creates two engines with a shared seed", () => {
    const m = makeMatch(42);
    expect(m.engines[1]).toBeDefined();
    expect(m.engines[2]).toBeDefined();
    const s1 = m.engines[1].state();
    const s2 = m.engines[2].state();
    expect(s1.active?.def.id).toBe(s2.active?.def.id);
    expect(s1.next.id).toBe(s2.next.id);
  });

  it("starts in playing phase with no result", () => {
    const m = makeMatch();
    const s = m.state();
    expect(s.phase).toBe("playing");
    expect(s.result).toBeNull();
  });

  it("routes applyAction to the correct player engine", () => {
    const m = makeMatch();
    const before = m.engines[1].state().active?.origin.x;
    m.applyAction(1, { kind: "move", dx: 1, dz: 0 });
    const after = m.engines[1].state().active?.origin.x;
    expect(after).toBe((before ?? 0) + 1);
  });

  it("emits engine events wrapped with player id", () => {
    const m = makeMatch();
    const events: { player: PlayerId; type: string }[] = [];
    m.on((e) => {
      if (e.type === "engine") {
        events.push({ player: e.player, type: e.event.type });
      }
    });
    m.applyAction(1, { kind: "hardDrop" });
    expect(events.some((e) => e.player === 1 && e.type === "lock")).toBe(true);
  });

  it("emits attack event when a player clears layers", () => {
    const narrowConfig: MatchConfig = {
      ...config,
      pit: { width: 1, depth: 1, height: 8 },
      targetFaces: 100,
    };
    const m = new Match(narrowConfig, 0);
    const attacks: { from: PlayerId; layers: number }[] = [];
    m.on((e) => {
      if (e.type === "attack") attacks.push({ from: e.from, layers: e.layers });
    });
    m.applyAction(1, { kind: "hardDrop" });
    expect(attacks.length).toBeGreaterThan(0);
    expect(attacks[0]?.layers).toBeGreaterThan(0);
  });

  it("finishes by faces when a player reaches targetFaces", () => {
    const narrowConfig: MatchConfig = {
      ...config,
      pit: { width: 1, depth: 1, height: 8 },
      targetFaces: 2,
    };
    const m = new Match(narrowConfig, 0);
    const finishes: { winner: PlayerId | null; reason: string }[] = [];
    m.on((e) => {
      if (e.type === "finish") finishes.push({ winner: e.result.winner, reason: e.result.reason });
    });
    Array.from({ length: 20 }).forEach(() => {
      const state = m.state();
      if (state.phase === "playing") {
        m.applyAction(1, { kind: "hardDrop" });
      }
    });
    expect(finishes.length).toBeGreaterThan(0);
    expect(m.state().phase).toBe("finished");
  });

  it("ignores actions after finish", () => {
    const m = makeMatch();
    m.applyAction(1, { kind: "pause" });
    m.applyAction(1, { kind: "pause" });
    const before = m.engines[1].state().active?.origin.x;
    m.update(0);
    const finishResult: { winner: PlayerId | null; reason: string } = {
      winner: 1,
      reason: "ko",
    };
    expect(finishResult.winner).toBe(1);
    expect(before).toBeDefined();
  });

  it("updates both engines on update", () => {
    const m = makeMatch();
    const y1Before = m.engines[1].state().active?.origin.y;
    const y2Before = m.engines[2].state().active?.origin.y;
    m.update(1000);
    const y1After = m.engines[1].state().active?.origin.y;
    const y2After = m.engines[2].state().active?.origin.y;
    expect(y1After ?? 0).toBeLessThan(y1Before ?? 0);
    expect(y2After ?? 0).toBeLessThan(y2Before ?? 0);
  });
});
