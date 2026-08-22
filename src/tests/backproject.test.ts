import { describe, expect, it } from "vitest";
import {
  backprojectToCamera,
  backprojectToThree,
  cameraToThree,
} from "../geometry/backproject";
import {
  degreesToRadians,
  intrinsicsFromHorizontalFov,
} from "../geometry/camera";
import { buildPointCloudFromDepth } from "../geometry/pointCloud";
import { makePlaneDepth, makeUvColors } from "../geometry/syntheticDepth";

function oddGridIntrinsics(fovXDegrees: number) {
  return intrinsicsFromHorizontalFov({
    width: 5,
    height: 5,
    fovXRadians: degreesToRadians(fovXDegrees),
  });
}

describe("back-projection", () => {
  it("reconstructs the center pixel on the camera axis", () => {
    const K = oddGridIntrinsics(90);
    // fx = 5 / (2 * tan(45°)) = 2.5; center pixel is (2, 2)
    const camera = backprojectToCamera(2, 2, 1, K);
    expect(camera.x).toBeCloseTo(0, 10);
    expect(camera.y).toBeCloseTo(0, 10);
    expect(camera.z).toBe(1);

    const three = cameraToThree(camera);
    expect(three.x).toBeCloseTo(0, 10);
    expect(three.y).toBeCloseTo(0, 10);
    expect(three.z).toBeCloseTo(-1, 10);
  });

  it("reconstructs left/right pixels symmetrically", () => {
    const K = oddGridIntrinsics(90);
    const left = backprojectToCamera(0, 2, 1, K);
    const right = backprojectToCamera(4, 2, 1, K);
    // |x| = 2 / 2.5 = 0.8
    expect(left.x).toBeCloseTo(-0.8, 10);
    expect(right.x).toBeCloseTo(0.8, 10);
    expect(left.y).toBeCloseTo(0, 10);
    expect(right.y).toBeCloseTo(0, 10);
    expect(left.z).toBe(right.z);
  });

  it("maps image-top to +Y in Three.js and image-down to camera +Y", () => {
    const K = oddGridIntrinsics(90);
    const top = backprojectToCamera(2, 0, 1, K);
    const bottom = backprojectToCamera(2, 4, 1, K);
    expect(top.y).toBeCloseTo(-0.8, 10);
    expect(bottom.y).toBeCloseTo(0.8, 10);

    const topThree = backprojectToThree(2, 0, 1, K);
    const bottomThree = backprojectToThree(2, 4, 1, K);
    expect(topThree.y).toBeCloseTo(0.8, 10);
    expect(bottomThree.y).toBeCloseTo(-0.8, 10);
  });

  it("widens world X when horizontal FOV increases at fixed depth", () => {
    const z = 1;
    const u = 0;
    const v = 2;
    const narrow = backprojectToCamera(u, v, z, oddGridIntrinsics(60));
    const wide = backprojectToCamera(u, v, z, oddGridIntrinsics(90));
    expect(Math.abs(wide.x)).toBeGreaterThan(Math.abs(narrow.x));
    expect(wide.z).toBe(narrow.z);
  });
});

describe("plane point cloud", () => {
  it("places every valid plane point at three.z = −Z", () => {
    const K = oddGridIntrinsics(60);
    const depth = makePlaneDepth(5, 5, 1.5);
    const colors = makeUvColors(5, 5);
    const buffers = buildPointCloudFromDepth({
      depth,
      width: 5,
      height: 5,
      colors,
      intrinsics: K,
    });

    expect(buffers.validVertexCount).toBe(25);
    for (let i = 0; i < buffers.validVertexCount; i++) {
      expect(buffers.positions[i * 3 + 2]).toBeCloseTo(-1.5, 10);
    }
  });

  it("skips non-finite and non-positive depth", () => {
    const K = oddGridIntrinsics(60);
    const depth = makePlaneDepth(5, 5, 1);
    depth[0] = Number.NaN;
    depth[1] = Number.POSITIVE_INFINITY;
    depth[2] = 0;
    depth[3] = -1;
    const colors = makeUvColors(5, 5);
    const buffers = buildPointCloudFromDepth({
      depth,
      width: 5,
      height: 5,
      colors,
      intrinsics: K,
    });
    expect(buffers.validVertexCount).toBe(21);
  });
});
