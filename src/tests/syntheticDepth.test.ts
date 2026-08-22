import { describe, expect, it } from "vitest";
import { degreesToRadians, intrinsicsFromHorizontalFov } from "../geometry/camera";
import {
  makeSphereDepth,
  makeUvColors,
  raySphereZ,
} from "../geometry/syntheticDepth";

describe("synthetic sphere depth", () => {
  it("hits the front of the sphere on the optical axis", () => {
    const centerZ = 2;
    const radius = 0.5;
    expect(raySphereZ(0, 0, centerZ, radius)).toBeCloseTo(1.5, 10);
  });

  it("returns null for a ray that misses the sphere", () => {
    expect(raySphereZ(4, 0, 2, 0.5)).toBeNull();
  });

  it("uses sphere Z at the center and background Z in the corner", () => {
    const K = intrinsicsFromHorizontalFov({
      width: 5,
      height: 5,
      fovXRadians: degreesToRadians(60),
    });
    const depth = makeSphereDepth(K, {
      centerZ: 1.6,
      radius: 0.4,
      backgroundZ: 3,
    });
    const center = depth[2 * 5 + 2]!;
    const corner = depth[0]!;
    expect(center).toBeCloseTo(1.2, 6);
    expect(corner).toBe(3);
  });
});

describe("UV colors", () => {
  it("keeps the top-left dark and grows green downward", () => {
    const colors = makeUvColors(3, 3);
    expect(Array.from(colors.subarray(0, 3))).toEqual([0, 0, 48]);
    expect(Array.from(colors.subarray(6, 9))).toEqual([255, 0, 48]);
    expect(Array.from(colors.subarray(18, 21))).toEqual([0, 255, 48]);
    expect(Array.from(colors.subarray(24, 27))).toEqual([255, 255, 48]);
  });
});
