export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let s = this.state;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    this.state = s >>> 0;
    return this.state;
  }

  float(): number {
    return this.next() / 0x100000000;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.float() * maxExclusive);
  }

  pick<T>(items: readonly T[]): T {
    const idx = this.int(items.length);
    const item = items[idx];
    if (item === undefined) throw new Error("empty pick");
    return item;
  }
}
