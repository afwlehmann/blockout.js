import type { Vec3, PieceDef, Orientation, PieceOrientations } from "./types.js";

const rotateX = (v: Vec3): Vec3 => ({ x: v.x, y: -v.z, z: v.y });
const rotateY = (v: Vec3): Vec3 => ({ x: v.z, y: v.y, z: -v.x });
const rotateZ = (v: Vec3): Vec3 => ({ x: -v.y, y: v.x, z: v.z });

const apply = (fn: (v: Vec3) => Vec3, cells: readonly Vec3[]): Vec3[] => cells.map((c) => fn(c));

const normalize = (cells: readonly Vec3[]): { cells: Vec3[]; key: string } => {
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const minZ = Math.min(...cells.map((c) => c.z));
  const sorted = [...cells]
    .map((c) => ({ x: c.x - minX, y: c.y - minY, z: c.z - minZ }))
    .sort((a, b) => (a.x === b.x ? (a.y === b.y ? a.z - b.z : a.y - b.y) : a.x - b.x));
  return {
    cells: sorted,
    key: sorted.map((c) => `${String(c.x)},${String(c.y)},${String(c.z)}`).join("|"),
  };
};

const COMBO_INDEXES = Array.from({ length: 4 * 4 * 4 }, (_, i) => ({
  x: Math.floor(i / 16) % 4,
  y: Math.floor(i / 4) % 4,
  z: i % 4,
}));

interface Accumulator {
  current: Vec3[];
  orientations: Orientation[];
  seen: Set<string>;
}

const generateOrientations = (cells: readonly Vec3[]): Orientation[] => {
  const initial: Accumulator = {
    current: [...cells],
    orientations: [],
    seen: new Set<string>(),
  };
  const result = COMBO_INDEXES.reduce<Accumulator>((acc, { x, y, z }) => {
    const applied: Vec3[] = Array.from({ length: z + 1 }, () => rotateZ).reduce(
      (c, fn) => apply(fn, c),
      acc.current,
    );
    const withY: Vec3[] = Array.from({ length: y + 1 }, () => rotateY).reduce(
      (c, fn) => apply(fn, c),
      applied,
    );
    const withX: Vec3[] = Array.from({ length: x + 1 }, () => rotateX).reduce(
      (c, fn) => apply(fn, c),
      withY,
    );
    const next = { ...acc, current: withX };
    const norm = normalize(next.current);
    if (!next.seen.has(norm.key)) {
      next.orientations.push({ cells: norm.cells, key: norm.key });
      next.seen.add(norm.key);
    }
    return next;
  }, initial);
  return result.orientations;
};

const buildPiece = (def: PieceDef): PieceOrientations => ({
  def,
  orientations: generateOrientations(def.cells),
});

export const buildPieces = (defs: readonly PieceDef[]): PieceOrientations[] => defs.map(buildPiece);

export const rotations = { rotateX, rotateY, rotateZ };
