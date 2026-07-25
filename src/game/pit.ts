import type { PitConfig, Vec3 } from "./types.js";

export type Cell = number;

export interface PlacedPiece {
  readonly cells: readonly Vec3[];
  readonly color: Cell;
}

export interface LockResult {
  readonly clearedLayers: readonly number[];
  readonly blockOut: boolean;
  readonly overflowed: boolean;
}

export interface RaiseResult {
  readonly overflowed: boolean;
  readonly shiftedBy: number;
}

const index = (w: number, d: number, x: number, y: number, z: number): number =>
  x + w * (z + d * y);

export class Pit {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  private grid: Cell[];

  constructor(config: PitConfig) {
    this.width = config.width;
    this.depth = config.depth;
    this.height = config.height;
    this.grid = new Array(this.width * this.depth * this.height).fill(0) as Cell[];
  }

  private inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < this.width && z >= 0 && z < this.depth && y >= 0 && y < this.height;
  }

  private cellAt(x: number, y: number, z: number): Cell {
    if (!this.inBounds(x, y, z)) return 0;
    return this.grid[index(this.width, this.depth, x, y, z)] ?? 0;
  }

  private setCell(x: number, y: number, z: number, value: Cell): void {
    if (this.inBounds(x, y, z)) {
      this.grid[index(this.width, this.depth, x, y, z)] = value;
    }
  }

  collides(origin: Vec3, cells: readonly Vec3[]): boolean {
    return cells.some((c) => {
      const x = origin.x + c.x;
      const y = origin.y + c.y;
      const z = origin.z + c.z;
      if (x < 0 || x >= this.width) return true;
      if (z < 0 || z >= this.depth) return true;
      if (y < 0) return true;
      if (y >= this.height) return false;
      return this.cellAt(x, y, z) !== 0;
    });
  }

  lock(origin: Vec3, cells: readonly Vec3[], color: Cell): LockResult {
    cells.forEach((c) => {
      const x = origin.x + c.x;
      const y = origin.y + c.y;
      const z = origin.z + c.z;
      if (this.inBounds(x, y, z)) {
        this.setCell(x, y, z, color);
      }
    });

    const clearedLayers = this.detectAndClearLayers();
    const blockOut = this.grid.every((c) => c === 0);
    const overflowed = this.topLayerOccupied();

    return { clearedLayers, blockOut, overflowed };
  }

  private detectAndClearLayers(): number[] {
    const layerIndexes = Array.from({ length: this.height }, (_, y) => y);
    const cleared = layerIndexes.filter((y) => this.isLayerFull(y));
    if (cleared.length > 0) {
      this.compactLayers(cleared);
    }
    return cleared;
  }

  private isLayerFull(y: number): boolean {
    const slice = this.grid.slice(y * this.width * this.depth, (y + 1) * this.width * this.depth);
    return slice.every((c) => c !== 0);
  }

  private compactLayers(clearedLayers: readonly number[]): void {
    const kept: Cell[] = [];
    this.grid.forEach((c, i) => {
      const y = Math.floor(i / (this.width * this.depth));
      if (!clearedLayers.includes(y)) kept.push(c);
    });
    const clearedCount = clearedLayers.length;
    const emptyTop = new Array(this.width * this.depth * clearedCount).fill(0) as Cell[];
    this.grid = [...kept, ...emptyTop];
  }

  raiseStack(layers: number): RaiseResult {
    const shiftedBy = Math.min(layers, this.height);
    const rowsPerLayer = this.width * this.depth;
    const overflowCheck = this.grid.slice((this.height - shiftedBy) * rowsPerLayer);
    const overflowed = overflowCheck.some((c) => c !== 0);
    const kept = this.grid.slice(0, (this.height - shiftedBy) * rowsPerLayer);
    const emptyBottom = new Array(rowsPerLayer * shiftedBy).fill(0) as Cell[];
    this.grid = [...emptyBottom, ...kept];
    return { overflowed, shiftedBy };
  }

  private topLayerOccupied(): boolean {
    const topStart = (this.height - 1) * this.width * this.depth;
    return this.grid.slice(topStart).some((c) => c !== 0);
  }

  snapshot(): readonly Cell[] {
    return [...this.grid];
  }
}
