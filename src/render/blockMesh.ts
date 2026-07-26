import * as THREE from "three";
import type { PitConfig } from "../game/types.js";

const CELL = 1;
const GAP = 0.04;
const BLOCK_SIZE = CELL - GAP;

const boxGeom = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
const edgeGeom = new THREE.EdgesGeometry(boxGeom);

export const blockGeometry = boxGeom;

export const makeBlockMaterial = (color: number): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.1,
    emissive: color,
    emissiveIntensity: 0.12,
  });

export class BlockMesh {
  readonly mesh: THREE.InstancedMesh;
  private readonly edgeMesh: THREE.InstancedMesh;
  private readonly width: number;
  private readonly depth: number;
  private readonly height: number;
  private readonly capacity: number;
  private readonly dummy: THREE.Object3D;
  private readonly tmpColor: THREE.Color;

  constructor(config: PitConfig, _maxColors: number) {
    this.width = config.width;
    this.depth = config.depth;
    this.height = config.height;
    this.capacity = this.width * this.depth * this.height;
    this.dummy = new THREE.Object3D();
    this.tmpColor = new THREE.Color();

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.1,
      emissive: 0xffffff,
      emissiveIntensity: 0.12,
      vertexColors: true,
    });

    this.mesh = new THREE.InstancedMesh(boxGeom, material, this.capacity);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const colorArray = new Float32Array(this.capacity * 3);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    this.mesh.count = 0;

    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xdddddd,
      transparent: true,
      opacity: 0.5,
    });
    this.edgeMesh = new THREE.InstancedMesh(edgeGeom, edgeMaterial, this.capacity);
    this.edgeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.edgeMesh.count = 0;
  }

  get edgeObject(): THREE.InstancedMesh {
    return this.edgeMesh;
  }

  private setInstance(
    count: number,
    x: number,
    y: number,
    z: number,
    value: number,
    colorAttr: THREE.InstancedBufferAttribute,
  ): void {
    this.dummy.position.set(x, y, z);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(count, this.dummy.matrix);
    this.edgeMesh.setMatrixAt(count, this.dummy.matrix);
    this.tmpColor.setHex(value);
    colorAttr.setXYZ(count, this.tmpColor.r, this.tmpColor.g, this.tmpColor.b);
  }

  private finalize(count: number, colorAttr: THREE.InstancedBufferAttribute): void {
    this.mesh.count = count;
    this.edgeMesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.edgeMesh.instanceMatrix.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  update(grid: readonly number[], _colorPalette: readonly THREE.Color[]): void {
    let count = 0;
    const colorAttr = this.mesh.instanceColor;
    if (!colorAttr) return;

    grid.forEach((value, i) => {
      if (value === 0 || count >= this.capacity) return;
      const x = i % this.width;
      const remainder = Math.floor(i / this.width);
      const z = remainder % this.depth;
      const y = Math.floor(remainder / this.depth);

      this.setInstance(count, x, y, z, value, colorAttr);
      count += 1;
    });

    this.finalize(count, colorAttr);
  }

  updateWithSlide(
    postGrid: readonly number[],
    _preGrid: readonly number[],
    _colorPalette: readonly THREE.Color[],
    clearedLayers: readonly number[],
    slideProgress: number,
  ): void {
    let count = 0;
    const colorAttr = this.mesh.instanceColor;
    if (!colorAttr) return;

    const minCleared = Math.min(...clearedLayers);
    const slideOffset = clearedLayers.length * (1 - slideProgress);

    postGrid.forEach((value, i) => {
      if (value === 0 || count >= this.capacity) return;
      const x = i % this.width;
      const remainder = Math.floor(i / this.width);
      const z = remainder % this.depth;
      const y = Math.floor(remainder / this.depth);

      const renderY = y >= minCleared ? y + slideOffset : y;
      this.setInstance(count, x, renderY, z, value, colorAttr);
      count += 1;
    });

    this.finalize(count, colorAttr);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.edgeMesh.geometry.dispose();
    const mat = this.mesh.material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => {
        m.dispose();
      });
    } else {
      mat.dispose();
    }
    const edgeMat = this.edgeMesh.material;
    if (edgeMat instanceof THREE.Material) {
      edgeMat.dispose();
    }
  }
}
