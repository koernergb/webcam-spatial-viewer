import { describe, expect, it } from "vitest";
import { serializeMeshPly, serializePointCloudPly } from "../export/ply";
import type { ReconstructionBuffers } from "../geometry/types";

const buffers: ReconstructionBuffers = {
  positions: new Float32Array([0, 0, -1, 1, 0, -1, 0, 1, -1]),
  colors: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255]),
  indices: new Uint32Array([0, 2, 1]), validVertexCount: 3, validTriangleCount: 1,
};

describe("PLY export", () => {
  it("writes point counts and RGB vertices", () => {
    const ply = serializePointCloudPly(buffers);
    expect(ply).toContain("element vertex 3"); expect(ply).toContain("element face 0"); expect(ply).toContain("0 0 -1 255 0 0");
  });
  it("writes mesh faces with the established winding", () => {
    const ply = serializeMeshPly(buffers);
    expect(ply).toContain("element face 1"); expect(ply).toContain("3 0 2 1");
  });
});
