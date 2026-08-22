import {
  degreesToRadians,
  intrinsicsFromHorizontalFov,
} from "../geometry/camera";
import { buildPointCloudFromDepth } from "../geometry/pointCloud";
import {
  makePlaneDepth,
  makeSphereDepth,
  makeUvColors,
} from "../geometry/syntheticDepth";
import type { CameraIntrinsics, ReconstructionBuffers } from "../geometry/types";
import {
  PLANE_Z,
  SANDBOX_HEIGHT,
  SANDBOX_WIDTH,
  SPHERE_DEPTH,
} from "../state/settings";
import type { SyntheticScene } from "../state/viewerStore";

export interface SandboxReconstruction {
  intrinsics: CameraIntrinsics;
  buffers: ReconstructionBuffers;
  depth: Float32Array;
}

export function buildSandboxCloud(
  scene: SyntheticScene,
  fovXDegrees: number,
): SandboxReconstruction {
  const intrinsics = intrinsicsFromHorizontalFov({
    width: SANDBOX_WIDTH,
    height: SANDBOX_HEIGHT,
    fovXRadians: degreesToRadians(fovXDegrees),
  });

  const depth =
    scene === "plane"
      ? makePlaneDepth(SANDBOX_WIDTH, SANDBOX_HEIGHT, PLANE_Z)
      : makeSphereDepth(intrinsics, SPHERE_DEPTH);

  const colors = makeUvColors(SANDBOX_WIDTH, SANDBOX_HEIGHT);
  const buffers = buildPointCloudFromDepth({
    depth,
    width: SANDBOX_WIDTH,
    height: SANDBOX_HEIGHT,
    colors,
    intrinsics,
  });

  return { intrinsics, buffers, depth };
}
