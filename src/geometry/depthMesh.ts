import { backprojectToThree, isValidDepth } from "./backproject";
import type { CameraIntrinsics, ReconstructionBuffers, Vec3 } from "./types";

export interface DepthMeshOptions {
  stride?: number;
  discontinuityThreshold: number;
  maxEdgeLength: number;
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function buildDepthMesh(params: {
  depth: Float32Array;
  width: number;
  height: number;
  colors: Uint8Array;
  intrinsics: CameraIntrinsics;
  options: DepthMeshOptions;
}): ReconstructionBuffers {
  const { depth, width, height, colors, intrinsics } = params;
  const stride = params.options.stride ?? 1;
  if (stride < 1) throw new Error("Sampling stride must be >= 1.");
  const columns = Math.ceil(width / stride);
  const rows = Math.ceil(height / stride);
  const positions = new Float32Array(columns * rows * 3);
  const outColors = new Uint8Array(columns * rows * 3);
  const valid = new Uint8Array(columns * rows);

  for (let row = 0; row < rows; row++) {
    const v = Math.min(row * stride, height - 1);
    for (let column = 0; column < columns; column++) {
      const u = Math.min(column * stride, width - 1);
      const sourceIndex = v * width + u;
      const vertexIndex = row * columns + column;
      const offset = vertexIndex * 3;
      const z = depth[sourceIndex];
      if (isValidDepth(z)) {
        const point = backprojectToThree(u, v, z, intrinsics);
        positions.set([point.x, point.y, point.z], offset);
        valid[vertexIndex] = 1;
      }
      outColors.set(colors.subarray(sourceIndex * 3, sourceIndex * 3 + 3), offset);
    }
  }

  const accepted: number[] = [];
  const rejected: number[] = [];
  const testTriangle = (a: number, b: number, c: number) => {
    const target = valid[a] && valid[b] && valid[c] && trianglePasses(a, b, c) ? accepted : rejected;
    target.push(a, b, c);
  };
  const pointAt = (index: number): Vec3 => ({ x: positions[index * 3], y: positions[index * 3 + 1], z: positions[index * 3 + 2] });
  const trianglePasses = (a: number, b: number, c: number): boolean => {
    const pa = pointAt(a); const pb = pointAt(b); const pc = pointAt(c);
    const depths = [-pa.z, -pb.z, -pc.z];
    const min = Math.min(...depths); const max = Math.max(...depths);
    if ((max - min) / Math.max(min, Number.EPSILON) >= params.options.discontinuityThreshold) return false;
    return Math.max(distance(pa, pb), distance(pb, pc), distance(pc, pa)) <= params.options.maxEdgeLength;
  };

  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const a = row * columns + column;
      const b = a + 1;
      const c = a + columns;
      const d = c + 1;
      testTriangle(a, c, b);
      testTriangle(b, c, d);
    }
  }
  const candidateTriangleCount = (rows - 1) * (columns - 1) * 2;
  return {
    positions, colors: outColors, indices: Uint32Array.from(accepted),
    rejectedIndices: Uint32Array.from(rejected), validVertexCount: valid.reduce((sum, item) => sum + item, 0),
    validTriangleCount: accepted.length / 3, candidateTriangleCount,
    rejectedTriangleCount: candidateTriangleCount - accepted.length / 3,
  };
}
