import { normalizeDepth } from "./normalization";

/** Map relative proximity (larger = nearer) into positive relative camera Z. */
export function relativeProximityToDepth(
  proximity: Float32Array,
  options: { near: number; far: number; scale?: number },
): Float32Array {
  const { near, far } = options;
  const scale = options.scale ?? 1;
  if (!(near > 0 && far > near && scale > 0)) {
    throw new Error("Expected 0 < near < far and a positive depth scale.");
  }
  const normalized = normalizeDepth(proximity);
  const depth = new Float32Array(proximity.length);
  for (let index = 0; index < proximity.length; index++) {
    depth[index] = Number.isFinite(proximity[index])
      ? (near + (1 - normalized.values[index]) * (far - near)) * scale
      : Number.NaN;
  }
  return depth;
}
