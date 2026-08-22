import { describe, expect, it } from "vitest";
import {
  degreesToRadians,
  intrinsicsFromHorizontalFov,
  verticalFovRadians,
} from "../geometry/camera";

describe("intrinsicsFromHorizontalFov", () => {
  it("maps 90° horizontal FOV to fx = width / 2", () => {
    const K = intrinsicsFromHorizontalFov({
      width: 640,
      height: 480,
      fovXRadians: Math.PI / 2,
    });
    expect(K.fx).toBeCloseTo(320, 10);
    expect(K.fy).toBe(K.fx);
  });

  it("places the principal point at the pixel-grid center", () => {
    const K = intrinsicsFromHorizontalFov({
      width: 5,
      height: 7,
      fovXRadians: degreesToRadians(60),
    });
    expect(K.cx).toBe(2);
    expect(K.cy).toBe(3);
  });

  it("uses square pixels so fy equals fx", () => {
    const K = intrinsicsFromHorizontalFov({
      width: 320,
      height: 240,
      fovXRadians: degreesToRadians(60),
    });
    expect(K.fy).toBe(K.fx);
    const expectedFx = 320 / (2 * Math.tan(Math.PI / 6));
    expect(K.fx).toBeCloseTo(expectedFx, 10);
  });

  it("derives vertical FOV from fy and image height", () => {
    const K = intrinsicsFromHorizontalFov({
      width: 320,
      height: 240,
      fovXRadians: Math.PI / 2,
    });
    // fx = 160; fovY = 2 * atan(H / (2 fy)) = 2 * atan(240 / 320)
    expect(verticalFovRadians(K)).toBeCloseTo(2 * Math.atan(240 / 320), 10);
  });
});
