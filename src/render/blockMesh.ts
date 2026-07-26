import * as THREE from "three";
import type { PitConfig } from "../game/types.js";

const CELL = 1;
const GAP = 0.04;
const BLOCK_SIZE = CELL - GAP;

export const blockGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

export const makeBlockMaterial = (color: number): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.15,
    emissive: color,
    emissiveIntensity: 0.08,
  });

export class BlockMesh {
  readonly mesh: THREE.InstancedMesh;
  private readonly width: number;
  private readonly depth: number;
  private readonly height: number;
  private readonly capacity: number;
  private readonly dummy: THREE.Object3D;

  constructor(config: PitConfig, _maxColors: number) {
    this.width = config.width;
    this.depth = config.depth;
    this.height = config.height;
    this.capacity = this.width * this.depth * this.height;
    this.dummy = new THREE.Object3D();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.4,
      metalness: 0.15,
      emissiveIntensity: 0.08,
    });

    this.mesh = new THREE.InstancedMesh(blockGeometry, material, this.capacity);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const colorArray = new Float32Array(this.capacity * 3);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    this.mesh.count = 0;
  }

  update(grid: readonly number[], colorPalette: readonly THREE.Color[]): void {
    let count = 0;
    const colorAttr = this.mesh.instanceColor;
    if (!colorAttr) return;

    grid.forEach((value, i) => {
      if (value === 0 || count >= this.capacity) return;
      const x = i % this.width;
      const remainder = Math.floor(i / this.width);
      const z = remainder % this.depth;
      const y = Math.floor(remainder / this.depth);

      this.dummy.position.set(x, y, z);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(count, this.dummy.matrix);

      const color = colorPalette[value - 1] ?? colorPalette[0];
      if (color) {
        colorAttr.setXYZ(count, color.r, color.g, color.b);
      }
      count += 1;
    });

    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    const mat = this.mesh.material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => {
        m.dispose();
      });
    } else {
      mat.dispose();
    }
  }
}
