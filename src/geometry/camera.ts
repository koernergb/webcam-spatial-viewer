import type { CameraIntrinsics } from "./types";

/**
 * Build pinhole intrinsics from an uncalibrated horizontal field of view.
 *
 * Square pixels: fy = fx. Principal point at the pixel-grid center.
 * See ./README.md for the image / camera / Three.js conventions.
 */
export function intrinsicsFromHorizontalFov(params: {
  width: number;
  height: number;
  fovXRadians: number;
}): CameraIntrinsics {
  const { width, height, fovXRadians } = params;
  if (width < 1 || height < 1) {
    throw new Error("Image size must be at least 1×1.");
  }
  if (!(fovXRadians > 0 && fovXRadians < Math.PI)) {
    throw new Error("Horizontal FOV must be in (0, π) radians.");
  }

  const fx = width / (2 * Math.tan(fovXRadians / 2));
  const fy = fx;
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;

  return { width, height, fx, fy, cx, cy, fovXRadians };
}

export function verticalFovRadians(intrinsics: CameraIntrinsics): number {
  return 2 * Math.atan(intrinsics.height / (2 * intrinsics.fy));
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
