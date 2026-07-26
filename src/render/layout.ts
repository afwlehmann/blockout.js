import * as THREE from "three";
import type { PitView } from "./pitView.js";

export interface ViewportRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type ViewportCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera;

interface RenderTarget {
  readonly camera: ViewportCamera;
  readonly region: ViewportRegion;
  readonly pitView: PitView;
  readonly isMain: boolean;
}

const MAIN_WIDTH = 0.75;
const SIDE_AREA_WIDTH = 0.25;
const SIDE_GAP = 0.005;
const SIDE_CELL_WIDTH = (SIDE_AREA_WIDTH - SIDE_GAP) / 2;
const SIDE_CELL_HEIGHT = 0.48;
const SIDE_OFFSET_Y = 1 - SIDE_CELL_HEIGHT * 2 - SIDE_GAP;

const SIDE_POSITIONS: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

export class SplitScreenLayout {
  readonly pitViews: readonly PitView[];
  private readonly sideViewMode: boolean;
  private cachedTargets: readonly RenderTarget[] | null = null;

  constructor(pitViews: readonly PitView[]) {
    this.pitViews = pitViews;
    this.sideViewMode = pitViews.length === 1;
  }

  private buildTargets(): readonly RenderTarget[] {
    if (this.sideViewMode) {
      const view = this.pitViews[0];
      if (!view) return [];
      const mainRegion: ViewportRegion = { x: 0, y: 0, width: MAIN_WIDTH, height: 1 };
      return [
        { camera: view.activeCamera, region: mainRegion, pitView: view, isMain: true },
        ...view.sideCameras.map((cam, i) => {
          const [col, row] = SIDE_POSITIONS[i] ?? [0, 0];
          return {
            camera: cam,
            region: {
              x: MAIN_WIDTH + col * (SIDE_CELL_WIDTH + SIDE_GAP),
              y: SIDE_OFFSET_Y + row * (SIDE_CELL_HEIGHT + SIDE_GAP),
              width: SIDE_CELL_WIDTH,
              height: SIDE_CELL_HEIGHT,
            },
            pitView: view,
            isMain: false,
          };
        }),
      ];
    }
    return this.pitViews.map((view, i) => ({
      camera: view.activeCamera,
      region: {
        x: i / this.pitViews.length,
        y: 0,
        width: 1 / this.pitViews.length,
        height: 1,
      },
      pitView: view,
      isMain: true,
    }));
  }

  get targets(): readonly RenderTarget[] {
    return (this.cachedTargets ??= this.buildTargets());
  }

  get regions(): readonly ViewportRegion[] {
    return this.targets.map((t) => t.region);
  }

  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    containerWidth: number,
    containerHeight: number,
  ): void {
    renderer.setScissorTest(true);
    this.targets.forEach((target) => {
      const { x: rx, y: ry, width: rw, height: rh } = target.region;

      const x = Math.floor(rx * containerWidth);
      const y = Math.floor(ry * containerHeight);
      const w = Math.floor(rw * containerWidth);
      const h = Math.floor(rh * containerHeight);

      renderer.setViewport(x, y, w, h);
      renderer.setScissor(x, y, w, h);

      if (target.isMain) {
        target.pitView.setAspect(w / h);
      } else {
        target.pitView.setSideAspect(w / h);
      }

      renderer.render(scene, target.camera);
    });
    renderer.setScissorTest(false);
  }
}
