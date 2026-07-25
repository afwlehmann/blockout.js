import { describe, it, expect } from "vitest";
import { Pit } from "./pit.js";
import type { PitConfig, Vec3 } from "./types.js";

const config: PitConfig = { width: 3, depth: 3, height: 5 };
const make = () => new Pit(config);

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

describe("Pit dimensions and grid", () => {
  it("initializes an empty grid of w*d*h cells", () => {
    const pit = make();
    expect(pit.width).toBe(3);
    expect(pit.depth).toBe(3);
    expect(pit.height).toBe(5);
    expect(pit.snapshot().length).toBe(45);
    expect(pit.snapshot().every((c) => c === 0)).toBe(true);
  });
});

describe("Pit.collides", () => {
  it("does not collide with empty pit at floor", () => {
    const pit = make();
    expect(pit.collides(v(0, 0, 0), [v(0, 0, 0)])).toBe(false);
  });

  it("collides with side walls", () => {
    const pit = make();
    expect(pit.collides(v(-1, 0, 0), [v(0, 0, 0)])).toBe(true);
    expect(pit.collides(v(3, 0, 0), [v(0, 0, 0)])).toBe(true);
  });

  it("collides with depth walls", () => {
    const pit = make();
    expect(pit.collides(v(0, 0, -1), [v(0, 0, 0)])).toBe(true);
    expect(pit.collides(v(0, 0, 3), [v(0, 0, 0)])).toBe(true);
  });

  it("collides with floor (negative y)", () => {
    const pit = make();
    expect(pit.collides(v(0, -1, 0), [v(0, 0, 0)])).toBe(true);
  });

  it("does not collide above the pit (y >= height)", () => {
    const pit = make();
    expect(pit.collides(v(0, 5, 0), [v(0, 0, 0)])).toBe(false);
    expect(pit.collides(v(0, 10, 0), [v(0, 0, 0)])).toBe(false);
  });

  it("collides with a previously locked cell", () => {
    const pit = make();
    pit.lock(v(0, 0, 0), [v(0, 0, 0)], 7);
    expect(pit.collides(v(0, 0, 0), [v(0, 0, 0)])).toBe(true);
  });
});

describe("Pit.lock", () => {
  it("writes the piece color into the grid", () => {
    const pit = make();
    pit.lock(v(1, 0, 1), [v(0, 0, 0)], 7);
    const snap = pit.snapshot();
    const idx = 1 + 3 * (1 + 3 * 0);
    expect(snap[idx]).toBe(7);
  });

  it("returns empty clearedLayers when no layer is full", () => {
    const pit = make();
    const result = pit.lock(v(0, 0, 0), [v(0, 0, 0)], 1);
    expect(result.clearedLayers).toEqual([]);
    expect(result.blockOut).toBe(false);
  });

  it("detects and clears a full layer, compacting above downward", () => {
    const pit = make();
    const color = 4;
    const floorCells: Vec3[] = [];
    for (let x = 0; x < 3; x++) {
      for (let z = 0; z < 3; z++) {
        floorCells.push(v(x, 0, z));
      }
    }
    const result = pit.lock(v(0, 0, 0), floorCells, color);
    expect(result.clearedLayers).toEqual([0]);
    expect(result.blockOut).toBe(true);
    expect(pit.snapshot().every((c) => c === 0)).toBe(true);
  });

  it("clears multiple full layers in a single lock", () => {
    const pit = make();
    const color = 4;
    const fillLayer = (y: number): Vec3[] => {
      const cells: Vec3[] = [];
      for (let x = 0; x < 3; x++) {
        for (let z = 0; z < 3; z++) {
          cells.push(v(x, y, z));
        }
      }
      return cells;
    };
    const cells = [...fillLayer(0), ...fillLayer(1)];
    const result = pit.lock(v(0, 0, 0), cells, color);
    expect(result.clearedLayers).toEqual([0, 1]);
    expect(result.blockOut).toBe(true);
  });

  it("compacts higher layers down after a clear", () => {
    const pit = make();
    pit.lock(v(0, 2, 0), [v(0, 0, 0)], 9);
    const cells: Vec3[] = [];
    for (let x = 0; x < 3; x++) {
      for (let z = 0; z < 3; z++) {
        cells.push(v(x, 0, z));
      }
    }
    pit.lock(v(0, 0, 0), cells, 1);
    const idx = 0 + 3 * (0 + 3 * 1);
    expect(pit.snapshot()[idx]).toBe(9);
  });

  it("marks overflowed when a cell sits in the top layer after lock", () => {
    const pit = make();
    const result = pit.lock(v(0, 4, 0), [v(0, 0, 0)], 2);
    expect(result.overflowed).toBe(true);
  });
});

describe("Pit.raiseStack", () => {
  it("shifts all cells up by N layers", () => {
    const pit = make();
    pit.lock(v(0, 0, 0), [v(0, 0, 0)], 5);
    pit.raiseStack(1);
    const idx = 0 + 3 * (0 + 3 * 1);
    expect(pit.snapshot()[idx]).toBe(5);
    const floorIdx = 0 + 3 * (0 + 3 * 0);
    expect(pit.snapshot()[floorIdx]).toBe(0);
  });

  it("reports overflow when a cell is pushed past the top", () => {
    const pit = make();
    pit.lock(v(0, 4, 0), [v(0, 0, 0)], 5);
    const result = pit.raiseStack(1);
    expect(result.overflowed).toBe(true);
  });

  it("does not overflow when raising an empty pit", () => {
    const pit = make();
    const result = pit.raiseStack(2);
    expect(result.overflowed).toBe(false);
    expect(result.shiftedBy).toBe(2);
  });
});
