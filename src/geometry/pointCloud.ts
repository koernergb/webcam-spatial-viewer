import { backprojectToThree, isValidDepth } from "./backproject";
import type { CameraIntrinsics, ReconstructionBuffers } from "./types";

export function buildPointCloudFromDepth(params: {
  depth: Float32Array;
  width: number;
  height: number;
  colors: Uint8Array;
  intrinsics: CameraIntrinsics;
  stride?: number;
}): ReconstructionBuffers {
  const { depth, width, height, colors, intrinsics } = params;
  const stride = params.stride ?? 1;
  if (stride < 1) {
    throw new Error("Sampling stride must be >= 1.");
  }

  const maxCount =
    Math.ceil(width / stride) * Math.ceil(height / stride);
  const positions = new Float32Array(maxCount * 3);
  const outColors = new Uint8Array(maxCount * 3);

  let n = 0;
  for (let v = 0; v < height; v += stride) {
    for (let u = 0; u < width; u += stride) {
      const z = depth[v * width + u]!;
      if (!isValidDepth(z)) continue;

      const p = backprojectToThree(u, v, z, intrinsics);
      const o = n * 3;
      positions[o] = p.x;
      positions[o + 1] = p.y;
      positions[o + 2] = p.z;

      const ci = (v * width + u) * 3;
      outColors[o] = colors[ci]!;
      outColors[o + 1] = colors[ci + 1]!;
      outColors[o + 2] = colors[ci + 2]!;
      n += 1;
    }
  }

  return {
    positions,
    colors: outColors,
    validVertexCount: n,
  };
}
