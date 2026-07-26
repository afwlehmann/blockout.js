import * as THREE from "three";
import type { PitView } from "./pitView.js";

export interface ViewportRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export class SplitScreenLayout {
  readonly pitViews: readonly PitView[];

  constructor(pitViews: readonly PitView[]) {
    this.pitViews = pitViews;
  }

  get regions(): readonly ViewportRegion[] {
    const count = this.pitViews.length;
    if (count === 1) {
      return [{ x: 0, y: 0, width: 1, height: 1 }];
    }
    return this.pitViews.map((_, i) => ({
      x: i / count,
      y: 0,
      width: 1 / count,
      height: 1,
    }));
  }

  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    containerWidth: number,
    containerHeight: number,
  ): void {
    renderer.setScissorTest(true);
    this.pitViews.forEach((view, i) => {
      const region = this.regions[i];
      if (!region) return;

      const x = Math.floor(region.x * containerWidth);
      const y = Math.floor(region.y * containerHeight);
      const w = Math.floor(region.width * containerWidth);
      const h = Math.floor(region.height * containerHeight);

      renderer.setViewport(x, y, w, h);
      renderer.setScissor(x, y, w, h);
      view.setAspect(w / h);
      renderer.render(scene, view.activeCamera);
    });
    renderer.setScissorTest(false);
  }
}
