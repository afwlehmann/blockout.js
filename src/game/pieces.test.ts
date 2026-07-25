import { describe, it, expect } from "vitest";
import { buildPieces, rotations } from "./pieces.js";
import { PIECE_DEFS } from "./registry.js";
import type { PieceOrientations, Vec3 } from "./types.js";

const built = buildPieces(PIECE_DEFS);
const byId = (id: string): PieceOrientations => {
  const piece = built.find((p) => p.def.id === id);
  if (!piece) throw new Error(`unknown piece ${id}`);
  return piece;
};

describe("piece orientations", () => {
  it("produces at least one orientation per piece", () => {
    built.forEach((p) => {
      expect(p.orientations.length).toBeGreaterThan(0);
    });
  });

  it("limits asymmetric pieces to the 24 rotation group", () => {
    built.forEach((p) => {
      expect(p.orientations.length).toBeLessThanOrEqual(24);
    });
  });

  it("deduplicates symmetric pieces (single-cube has exactly 1)", () => {
    expect(byId("I").orientations.length).toBe(1);
  });

  it("2x2 flat square has exactly 3 orientations (flat + two upright)", () => {
    expect(byId("Square").orientations.length).toBe(3);
  });

  it("domino (2-cell line) has exactly 3 orientations", () => {
    expect(byId("O").orientations.length).toBe(3);
  });

  it("each orientation stays within its normalized bounding box starting at origin", () => {
    built.forEach((p) => {
      p.orientations.forEach((o) => {
        o.cells.forEach((c) => {
          expect(c.x).toBeGreaterThanOrEqual(0);
          expect(c.y).toBeGreaterThanOrEqual(0);
          expect(c.z).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });

  it("no duplicate orientation keys within a piece", () => {
    built.forEach((p) => {
      const keys = p.orientations.map((o) => o.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});

describe("rotations", () => {
  const v: Vec3 = { x: 1, y: 2, z: 3 };

  it("rotateX preserves x and rotates y/z", () => {
    expect(rotations.rotateX(v)).toEqual({ x: 1, y: -3, z: 2 });
  });

  it("rotateY preserves y and rotates x/z", () => {
    expect(rotations.rotateY(v)).toEqual({ x: 3, y: 2, z: -1 });
  });

  it("rotateZ preserves z and rotates x/y", () => {
    expect(rotations.rotateZ(v)).toEqual({ x: -2, y: 1, z: 3 });
  });

  it("four rotateX bring any vector back to itself", () => {
    const r = [rotations.rotateX, rotations.rotateX, rotations.rotateX, rotations.rotateX].reduce(
      (acc, fn) => fn(acc),
      v,
    );
    expect(r).toEqual(v);
  });
});
