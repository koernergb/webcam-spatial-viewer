import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  radiansToDegrees,
  verticalFovRadians,
} from "../geometry/camera";
import type { CameraIntrinsics, ReconstructionBuffers } from "../geometry/types";
import { SourceCameraFrustum } from "./CameraFrustum";
import { PointCloudRenderer } from "./PointCloudRenderer";
import { MeshRenderer, type SpatialRenderMode } from "./MeshRenderer";

const INSPECT_FOV = 50;
const INSPECT_POSITION = new THREE.Vector3(1.35, 0.9, 1.55);
const INSPECT_TARGET = new THREE.Vector3(0, 0, -1.4);

export class SpatialViewport {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly viewCamera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private readonly pointCloud: PointCloudRenderer;
  private readonly mesh: MeshRenderer;
  private readonly axes: THREE.AxesHelper;
  private readonly grid: THREE.GridHelper;
  private readonly lookArrow: THREE.ArrowHelper;
  private readonly frustum: SourceCameraFrustum;
  private readonly resizeObserver: ResizeObserver;
  private raf = 0;
  private disposed = false;
  private sourceIntrinsics: CameraIntrinsics | null = null;

  constructor(private readonly container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e0f12);

    this.viewCamera = new THREE.PerspectiveCamera(INSPECT_FOV, 1, 0.05, 40);
    this.viewCamera.up.set(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.viewCamera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.copy(INSPECT_TARGET);

    this.pointCloud = new PointCloudRenderer();
    this.scene.add(this.pointCloud.points);
    this.mesh = new MeshRenderer();
    this.scene.add(this.mesh.group);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 2.2));

    this.axes = new THREE.AxesHelper(0.45);
    this.scene.add(this.axes);

    this.grid = new THREE.GridHelper(4, 8, 0x2a3140, 0x1a2230);
    this.scene.add(this.grid);

    this.lookArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0, 0),
      0.5,
      0x4da3ff,
      0.08,
      0.05,
    );
    this.scene.add(this.lookArrow);

    this.frustum = new SourceCameraFrustum();
    this.scene.add(this.frustum.camera);
    this.scene.add(this.frustum.helper);

    this.viewCamera.position.copy(INSPECT_POSITION);
    this.viewCamera.lookAt(INSPECT_TARGET);

    this.resizeObserver = new ResizeObserver(() => this.syncSize());
    this.resizeObserver.observe(container);
    this.syncSize();
    this.tick();
  }

  setPointCloud(buffers: ReconstructionBuffers): void {
    this.pointCloud.setFromBuffers(buffers);
  }

  setMesh(buffers: ReconstructionBuffers): void {
    this.mesh.setFromBuffers(buffers);
  }

  setRenderMode(mode: SpatialRenderMode): void {
    this.pointCloud.points.visible = mode === "points";
    this.mesh.setMode(mode);
  }

  capturePng(): Promise<Blob> {
    this.renderer.render(this.scene, this.viewCamera);
    return new Promise((resolve, reject) => this.renderer.domElement.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not capture viewport.")), "image/png"));
  }

  setSourceIntrinsics(intrinsics: CameraIntrinsics): void {
    this.sourceIntrinsics = intrinsics;
    this.frustum.update(intrinsics);
  }

  setPointSize(size: number): void {
    this.pointCloud.setPointSize(size);
  }

  setShowAxes(visible: boolean): void {
    this.axes.visible = visible;
    this.lookArrow.visible = visible;
  }

  setShowGrid(visible: boolean): void {
    this.grid.visible = visible;
  }

  setShowFrustum(visible: boolean): void {
    this.frustum.setVisible(visible);
  }

  /** Pulled-back view so FOV changes are obvious against the axes. */
  resetToInspectView(): void {
    this.viewCamera.fov = INSPECT_FOV;
    this.viewCamera.near = 0.05;
    this.viewCamera.far = 40;
    this.viewCamera.position.copy(INSPECT_POSITION);
    this.viewCamera.updateProjectionMatrix();
    this.controls.target.copy(INSPECT_TARGET);
    this.controls.update();
  }

  /**
   * Place the view camera at the pinhole, looking toward −Z, with the
   * source vertical FOV. The cloud should sit inside the frustum helper.
   */
  resetToSourceCamera(): void {
    this.viewCamera.position.set(0, 0, 0);
    this.viewCamera.up.set(0, 1, 0);
    this.controls.target.set(0, 0, -1);
    if (this.sourceIntrinsics) {
      this.viewCamera.fov = radiansToDegrees(
        verticalFovRadians(this.sourceIntrinsics),
      );
    }
    this.viewCamera.near = 0.08;
    this.viewCamera.far = 20;
    this.viewCamera.updateProjectionMatrix();
    this.controls.update();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.pointCloud.dispose();
    this.mesh.dispose();
    this.frustum.dispose();
    this.axes.geometry.dispose();
    this.grid.geometry.dispose();
    const gridMaterial = this.grid.material;
    if (Array.isArray(gridMaterial)) {
      for (const item of gridMaterial) item.dispose();
    } else {
      gridMaterial.dispose();
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private syncSize(): void {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.viewCamera.aspect = width / height;
    this.viewCamera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private tick = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    this.controls.update();
    this.renderer.render(this.scene, this.viewCamera);
  };
}
