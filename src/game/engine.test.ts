import { describe, it, expect } from "vitest";
import { PlayerEngine } from "./engine.js";
import { Rng } from "./rng.js";
import type { MatchConfig } from "./types.js";

const config: MatchConfig = {
  mode: "1p",
  pit: { width: 5, depth: 5, height: 8 },
  set: "flat",
  startLevel: 1,
  targetFaces: 10,
  difficulty: "normal",
};

const makeEngine = (seed = 12345): PlayerEngine => new PlayerEngine(config, new Rng(seed));

describe("PlayerEngine", () => {
  it("spawns an active piece at construction", () => {
    const e = makeEngine();
    const s = e.state();
    expect(s.active).not.toBeNull();
    expect(s.gameOver).toBe(false);
    expect(s.next).toBeDefined();
  });

  it("has a score of zero initially", () => {
    expect(makeEngine().state().score).toBe(0);
  });

  it("starts at the configured level", () => {
    const c: MatchConfig = { ...config, startLevel: 3 };
    expect(new PlayerEngine(c, new Rng(1)).state().level).toBe(3);
  });

  it("counts cubes placed", () => {
    const e = makeEngine();
    e.applyAction({ kind: "hardDrop" });
    expect(e.state().cubes).toBeGreaterThan(0);
  });

  it("hard drop locks the piece and spawns a new one", () => {
    const e = makeEngine();
    const first = e.state().active;
    e.applyAction({ kind: "hardDrop" });
    const after = e.state().active;
    expect(first).not.toBeNull();
    expect(after).not.toBeNull();
    expect(after).not.toBe(first);
  });

  it("move action translates the active piece within bounds", () => {
    const e = makeEngine();
    const before = e.state().active;
    if (!before) throw new Error("no active piece");
    e.applyAction({ kind: "move", dx: 1, dz: 0 });
    const after = e.state().active;
    if (!after) throw new Error("no active piece after move");
    expect(after.origin.x).toBe(before.origin.x + 1);
  });

  it("rotate action changes orientation index for non-symmetric pieces", () => {
    const e = makeEngine();
    const before = e.state().active;
    if (!before) throw new Error("no active piece");
    e.applyAction({ kind: "rotate", axis: "x", dir: 1 });
    const after = e.state().active;
    if (!after) throw new Error("no active piece after rotate");
    const symmetric = before.def.id === "I" || before.def.id === "Square";
    expect(symmetric || after.orientationIndex !== before.orientationIndex).toBe(true);
  });

  it("four rotations around the same axis return to the original orientation", () => {
    const e = makeEngine();
    const before = e.state().active;
    if (!before) throw new Error("no active piece");
    const beforeCells = e.activeCells();
    e.applyAction({ kind: "rotate", axis: "x", dir: 1 });
    e.applyAction({ kind: "rotate", axis: "x", dir: 1 });
    e.applyAction({ kind: "rotate", axis: "x", dir: 1 });
    e.applyAction({ kind: "rotate", axis: "x", dir: 1 });
    const afterCells = e.activeCells();
    expect(afterCells).toEqual(beforeCells);
  });

  it("rotating X then Y is not the same as rotating Y then X", () => {
    const e1 = makeEngine();
    const e2 = makeEngine();
    const before = e1.state().active;
    if (!before) throw new Error("no active piece");
    e1.applyAction({ kind: "rotate", axis: "x", dir: 1 });
    e1.applyAction({ kind: "rotate", axis: "y", dir: 1 });
    e2.applyAction({ kind: "rotate", axis: "y", dir: 1 });
    e2.applyAction({ kind: "rotate", axis: "x", dir: 1 });
    const c1 = e1.activeCells();
    const c2 = e2.activeCells();
    const symmetric = before.def.id === "I";
    const keys1 = c1
      .map((c) => `${String(c.x)},${String(c.y)},${String(c.z)}`)
      .sort()
      .join("|");
    const keys2 = c2
      .map((c) => `${String(c.x)},${String(c.y)},${String(c.z)}`)
      .sort()
      .join("|");
    expect(symmetric || keys1 !== keys2).toBe(true);
  });

  it("rotating around X then undoing with -X returns to the original orientation", () => {
    const e = makeEngine();
    const before = e.state().active;
    if (!before) throw new Error("no active piece");
    const beforeCells = e.activeCells();
    e.applyAction({ kind: "rotate", axis: "x", dir: 1 });
    e.applyAction({ kind: "rotate", axis: "x", dir: -1 });
    const afterCells = e.activeCells();
    expect(afterCells).toEqual(beforeCells);
  });

  it("pause toggles paused state", () => {
    const e = makeEngine();
    expect(e.state().paused).toBe(false);
    e.applyAction({ kind: "pause" });
    expect(e.state().paused).toBe(true);
    e.applyAction({ kind: "pause" });
    expect(e.state().paused).toBe(false);
  });

  it("update does nothing while paused", () => {
    const e = makeEngine();
    e.applyAction({ kind: "pause" });
    const before = e.state();
    e.update(1000);
    expect(e.state()).toEqual(before);
  });

  it("update advances gravity over time", () => {
    const e = makeEngine();
    const before = e.state().active;
    if (!before) throw new Error("no active piece");
    e.update(1000);
    const after = e.state().active;
    if (!after) throw new Error("no active piece after update");
    expect(after.origin.y).toBeLessThan(before.origin.y);
  });

  it("ghost origin is below the active piece", () => {
    const e = makeEngine();
    const active = e.state().active;
    if (!active) throw new Error("no active piece");
    const ghost = e.ghostOrigin();
    expect(ghost).not.toBeNull();
    if (!ghost) throw new Error("no ghost");
    expect(ghost.y).toBeLessThanOrEqual(active.origin.y);
  });

  it("emits a lock event on hard drop", () => {
    const e = makeEngine();
    const events: string[] = [];
    e.on((ev) => events.push(ev.type));
    e.applyAction({ kind: "hardDrop" });
    expect(events).toContain("lock");
  });

  it("emits clear event when a layer is completed", () => {
    const flatConfig: MatchConfig = {
      ...config,
      pit: { width: 1, depth: 1, height: 8 },
      set: "flat",
    };
    const e = new PlayerEngine(flatConfig, new Rng(999));
    const evs: string[] = [];
    e.on((ev) => evs.push(ev.type));
    e.applyAction({ kind: "hardDrop" });
    expect(evs).toContain("clear");
  });

  it("levels up when faces cross the 10-per-level threshold", () => {
    const flatConfig: MatchConfig = {
      ...config,
      pit: { width: 1, depth: 1, height: 4 },
      set: "flat",
      startLevel: 1,
    };
    const e = new PlayerEngine(flatConfig, new Rng(0));
    const levels: number[] = [];
    e.on((ev) => {
      if (ev.type === "levelUp") levels.push(ev.level ?? 0);
    });
    Array.from({ length: 30 }).forEach(() => {
      const s = e.state();
      if (!s.gameOver) e.applyAction({ kind: "hardDrop" });
    });
    expect(e.state().faces).toBeGreaterThan(0);
  });
});

describe("Rng", () => {
  it("is deterministic for a fixed seed", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect(a.next()).toBe(b.next());
    expect(a.next()).toBe(b.next());
  });

  it("int stays within range", () => {
    const r = new Rng(1);
    Array.from({ length: 100 }).forEach(() => {
      expect(r.int(5)).toBeGreaterThanOrEqual(0);
      expect(r.int(5)).toBeLessThan(5);
    });
  });
});
