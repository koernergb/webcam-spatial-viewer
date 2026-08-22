import * as THREE from "three";
import {
  radiansToDegrees,
  verticalFovRadians,
} from "../geometry/camera";
import type { CameraIntrinsics } from "../geometry/types";

const SOURCE_NEAR = 0.2;
const SOURCE_FAR = 4;

/**
 * Fixed source-camera frustum at the origin, looking toward −Z.
 * Independent of the orbiting view camera.
 */
export class SourceCameraFrustum {
  readonly camera: THREE.PerspectiveCamera;
  readonly helper: THREE.CameraHelper;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(50, 1, SOURCE_NEAR, SOURCE_FAR);
    this.camera.position.set(0, 0, 0);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, -1);
    this.helper = new THREE.CameraHelper(this.camera);
  }

  update(intrinsics: CameraIntrinsics): void {
    this.camera.fov = radiansToDegrees(verticalFovRadians(intrinsics));
    this.camera.aspect = intrinsics.width / intrinsics.height;
    this.camera.near = SOURCE_NEAR;
    this.camera.far = SOURCE_FAR;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
    this.helper.update();
  }

  setVisible(visible: boolean): void {
    this.helper.visible = visible;
  }

  dispose(): void {
    this.helper.geometry.dispose();
    const material = this.helper.material;
    if (Array.isArray(material)) {
      for (const item of material) item.dispose();
    } else {
      material.dispose();
    }
  }
}
