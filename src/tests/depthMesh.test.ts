import { describe, expect, it } from "vitest";
import { intrinsicsFromHorizontalFov } from "../geometry/camera";
import { buildDepthMesh } from "../geometry/depthMesh";

const intrinsics = intrinsicsFromHorizontalFov({ width: 3, height: 2, fovXRadians: Math.PI / 2 });
const colors = new Uint8Array(3 * 2 * 3).fill(255);

describe("depth mesh", () => {
  it("builds consistently wound grid triangles", () => {
    const mesh = buildDepthMesh({ depth: new Float32Array(6).fill(1), width: 3, height: 2, colors, intrinsics, options: { discontinuityThreshold: 1, maxEdgeLength: 10 } });
    expect(Array.from(mesh.indices ?? [])).toEqual([0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5]);
    expect(mesh.validTriangleCount).toBe(4);
    const [a, b, c] = Array.from(mesh.indices!.slice(0, 3));
    const p = mesh.positions;
    const ab = [p[b * 3] - p[a * 3], p[b * 3 + 1] - p[a * 3 + 1]];
    const ac = [p[c * 3] - p[a * 3], p[c * 3 + 1] - p[a * 3 + 1]];
    expect(ab[0] * ac[1] - ab[1] * ac[0]).toBeGreaterThan(0);
  });
  it("rejects triangles spanning a depth discontinuity", () => {
    const mesh = buildDepthMesh({ depth: new Float32Array([1, 1, 4, 1, 1, 4]), width: 3, height: 2, colors, intrinsics, options: { discontinuityThreshold: 0.5, maxEdgeLength: 10 } });
    expect(mesh.validTriangleCount).toBe(2); expect(mesh.rejectedTriangleCount).toBe(2);
  });
  it("rejects triangles with an invalid vertex", () => {
    const mesh = buildDepthMesh({ depth: new Float32Array([1, 1, 1, 1, Number.NaN, 1]), width: 3, height: 2, colors, intrinsics, options: { discontinuityThreshold: 1, maxEdgeLength: 10 } });
    expect(mesh.validTriangleCount).toBe(1); expect(mesh.rejectedTriangleCount).toBe(3);
  });
});
