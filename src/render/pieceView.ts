import * as THREE from "three";
import { blockGeometry } from "./blockMesh.js";
import type { Vec3 } from "../game/types.js";

export class PieceView {
  readonly group: THREE.Group;
  private readonly ghostGroup: THREE.Group;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly ghostMaterial: THREE.MeshBasicMaterial;
  private readonly meshes: THREE.Mesh[] = [];

  constructor(color: number) {
    this.group = new THREE.Group();
    this.ghostGroup = new THREE.Group();

    this.material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.2,
      emissive: color,
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 0.92,
    });

    this.ghostMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      wireframe: false,
      depthWrite: false,
    });
  }

  addGhostTo(parent: THREE.Object3D): void {
    parent.add(this.ghostGroup);
  }

  removeGhost(parent: THREE.Object3D): void {
    parent.remove(this.ghostGroup);
  }

  update(cells: readonly Vec3[], origin: Vec3, ghostOrigin: Vec3 | null): void {
    this.syncMeshes(this.group, this.meshes, this.material, cells.length);
    this.group.position.set(origin.x, origin.y, origin.z);

    cells.forEach((c, i) => {
      const mesh = this.meshes[i];
      if (mesh) mesh.position.set(c.x, c.y, c.z);
    });

    while (this.ghostGroup.children.length < cells.length) {
      const mesh = new THREE.Mesh(blockGeometry, this.ghostMaterial);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.ghostGroup.add(mesh);
    }
    while (this.ghostGroup.children.length > cells.length) {
      const child = this.ghostGroup.children[this.ghostGroup.children.length - 1];
      if (child) this.ghostGroup.remove(child);
    }

    cells.forEach((c, i) => {
      const child = this.ghostGroup.children[i];
      if (child) child.position.set(c.x, c.y, c.z);
    });

    if (ghostOrigin) {
      this.ghostGroup.position.set(ghostOrigin.x, ghostOrigin.y, ghostOrigin.z);
      this.ghostGroup.visible = true;
    } else {
      this.ghostGroup.visible = false;
    }
  }

  private syncMeshes(
    parent: THREE.Group,
    pool: THREE.Mesh[],
    material: THREE.Material,
    needed: number,
  ): void {
    while (pool.length < needed) {
      const mesh = new THREE.Mesh(blockGeometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      pool.push(mesh);
    }
    while (pool.length > needed) {
      const mesh = pool.pop();
      if (mesh) parent.remove(mesh);
    }
  }

  dispose(): void {
    this.material.dispose();
    this.ghostMaterial.dispose();
  }
}
