import type { CameraIntrinsics } from "./types";

/** Constant-Z fronto-parallel plane in camera space. */
export function makePlaneDepth(
  width: number,
  height: number,
  z: number,
): Float32Array {
  const depth = new Float32Array(width * height);
  depth.fill(z);
  return depth;
}

/**
 * UV debug colors so orientation bugs are obvious:
 * R increases with u (right), G with v (down), B constant.
 * Top-left is dark; bottom-right is yellow-green.
 */
export function makeUvColors(width: number, height: number): Uint8Array {
  const colors = new Uint8Array(width * height * 3);
  const maxU = Math.max(width - 1, 1);
  const maxV = Math.max(height - 1, 1);
  for (let v = 0; v < height; v++) {
    for (let u = 0; u < width; u++) {
      const i = (v * width + u) * 3;
      colors[i] = Math.round((u / maxU) * 255);
      colors[i + 1] = Math.round((v / maxV) * 255);
      colors[i + 2] = 48;
    }
  }
  return colors;
}

export interface SphereDepthOptions {
  centerZ: number;
  radius: number;
  backgroundZ: number;
}

/**
 * Sphere on the optical axis plus a farther background plane.
 * Depth is camera-space Z of the nearer ray intersection.
 */
export function makeSphereDepth(
  intrinsics: CameraIntrinsics,
  options: SphereDepthOptions,
): Float32Array {
  const { width, height, fx, fy, cx, cy } = intrinsics;
  const { centerZ, radius, backgroundZ } = options;
  const depth = new Float32Array(width * height);

  for (let v = 0; v < height; v++) {
    for (let u = 0; u < width; u++) {
      const dx = (u - cx) / fx;
      const dy = (v - cy) / fy;
      const zHit = raySphereZ(dx, dy, centerZ, radius);
      depth[v * width + u] = zHit ?? backgroundZ;
    }
  }

  return depth;
}

/**
 * Ray X = t * dx, Y = t * dy, Z = t through a sphere at (0, 0, centerZ).
 * Returns the nearer positive Z, or null on a miss.
 */
export function raySphereZ(
  dx: number,
  dy: number,
  centerZ: number,
  radius: number,
): number | null {
  const a = dx * dx + dy * dy + 1;
  const b = -2 * centerZ;
  const c = centerZ * centerZ - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const sqrt = Math.sqrt(discriminant);
  const t0 = (-b - sqrt) / (2 * a);
  const t1 = (-b + sqrt) / (2 * a);
  const nearer = Math.min(t0, t1);
  const farther = Math.max(t0, t1);
  if (nearer > 0) return nearer;
  if (farther > 0) return farther;
  return null;
}
