import type { CameraIntrinsics, Vec3 } from "./types";

/**
 * Image (u, v, z) → camera space.
 *
 * Camera: +X right, +Y down, +Z forward (look axis).
 * `z` is camera-space Z, in relative scene units.
 */
export function backprojectToCamera(
  u: number,
  v: number,
  z: number,
  intrinsics: CameraIntrinsics,
): Vec3 {
  return {
    x: ((u - intrinsics.cx) * z) / intrinsics.fx,
    y: ((v - intrinsics.cy) * z) / intrinsics.fy,
    z,
  };
}

/**
 * Camera space → Three.js world. This is the only Y/Z sign conversion.
 *
 * three.x =  cam.x   // right
 * three.y = −cam.y   // image-down → world up
 * three.z = −cam.z   // +Z look → Three.js camera looking toward −Z
 */
export function cameraToThree(point: Vec3): Vec3 {
  return { x: point.x, y: -point.y, z: -point.z };
}

export function backprojectToThree(
  u: number,
  v: number,
  z: number,
  intrinsics: CameraIntrinsics,
): Vec3 {
  return cameraToThree(backprojectToCamera(u, v, z, intrinsics));
}

export function isValidDepth(z: number): boolean {
  return Number.isFinite(z) && z > 0;
}
