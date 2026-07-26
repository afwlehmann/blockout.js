import type { PieceDef, PieceSet } from "./types.js";

export const PIECE_DEFS: readonly PieceDef[] = [
  {
    id: "I",
    set: "flat",
    color: 0x00aa00,
    cells: [{ x: 0, y: 0, z: 0 }],
  },
  {
    id: "O",
    set: "flat",
    color: 0xffff55,
    cells: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ],
  },
  {
    id: "L",
    set: "flat",
    color: 0xaa5500,
    cells: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ],
  },
  {
    id: "T",
    set: "flat",
    color: 0xaa00aa,
    cells: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
    ],
  },
  {
    id: "S",
    set: "flat",
    color: 0xff5555,
    cells: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 0, z: 1 },
    ],
  },
  {
    id: "Square",
    set: "flat",
    color: 0x00aaaa,
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
    color: 0x55ff55,
    cells: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
    ],
  },
  {
    id: "T3",
    set: "basic",
    color: 0x5555ff,
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
    color: 0x55ffff,
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
    color: 0xff55ff,
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
