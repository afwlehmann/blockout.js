import * as THREE from "three";
import { blockGeometry } from "./blockMesh.js";
import type { Vec3 } from "../game/types.js";

const edgeGeometry = new THREE.EdgesGeometry(blockGeometry);
const edgeMaterial = new THREE.LineBasicMaterial({
  color: 0xdddddd,
  transparent: true,
  opacity: 0.5,
});

export class PieceView {
  readonly group: THREE.Group;
  private readonly ghostGroup: THREE.Group;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly ghostMaterial: THREE.MeshBasicMaterial;
  private readonly meshes: THREE.Mesh[] = [];
  private readonly edges: THREE.LineSegments[] = [];

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
    this.syncMeshes(cells.length);
    this.group.position.set(origin.x, origin.y, origin.z);

    cells.forEach((c, i) => {
      const mesh = this.meshes[i];
      if (mesh) mesh.position.set(c.x, c.y, c.z);
      const edge = this.edges[i];
      if (edge) edge.position.set(c.x, c.y, c.z);
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

  private syncMeshes(needed: number): void {
    while (this.meshes.length < needed) {
      const mesh = new THREE.Mesh(blockGeometry, this.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.meshes.push(mesh);

      const edge = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      this.group.add(edge);
      this.edges.push(edge);
    }
    while (this.meshes.length > needed) {
      const mesh = this.meshes.pop();
      if (mesh) this.group.remove(mesh);
      const edge = this.edges.pop();
      if (edge) this.group.remove(edge);
    }
  }

  dispose(): void {
    this.material.dispose();
    this.ghostMaterial.dispose();
    edgeMaterial.dispose();
    edgeGeometry.dispose();
  }
}
