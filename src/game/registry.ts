import type { PieceDef, PieceSet } from "./types.js";

export const PIECE_DEFS: readonly PieceDef[] = [
  {
    id: "I",
    set: "flat",
    color: 0x38bdf8,
    cells: [{ x: 0, y: 0, z: 0 }],
  },
  {
    id: "O",
    set: "flat",
    color: 0xfbbf24,
    cells: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ],
  },
  {
    id: "L",
    set: "flat",
    color: 0x4ade80,
    cells: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ],
  },
  {
    id: "T",
    set: "flat",
    color: 0xa78bfa,
    cells: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
    ],
  },
  {
    id: "S",
    set: "flat",
    color: 0xf472b6,
    cells: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 0, z: 1 },
    ],
  },
  {
    id: "Square",
    set: "flat",
    color: 0xfb7185,
    cells: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 0, z: 1 },
    ],
  },
  {
    id: "L3",
    set: "basic",
    color: 0x34d399,
    cells: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
    ],
  },
  {
    id: "T3",
    set: "basic",
    color: 0x818cf8,
    cells: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
    ],
  },
  {
    id: "Screw",
    set: "extended",
    color: 0x22d3ee,
    cells: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 1, y: 1, z: 1 },
    ],
  },
  {
    id: "Tripod",
    set: "extended",
    color: 0xfacc15,
    cells: [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 2, y: 0, z: 1 },
      { x: 1, y: 1, z: 1 },
    ],
  },
];

export const piecesForSet = (set: PieceSet): readonly PieceDef[] =>
  PIECE_DEFS.filter((p) => p.set === set);
