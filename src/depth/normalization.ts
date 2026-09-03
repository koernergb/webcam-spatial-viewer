export interface NormalizedDepth {
  values: Float32Array;
  low: number;
  high: number;
}

export function percentile(values: Float32Array, fraction: number): number {
  const finite = Array.from(values).filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return 0;
  const position = Math.max(0, Math.min(1, fraction)) * (finite.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return finite[lower] * (1 - weight) + finite[upper] * weight;
}

export function normalizeDepth(
  values: Float32Array,
  range?: { low: number; high: number },
): NormalizedDepth {
  const low = range?.low ?? percentile(values, 0.02);
  const high = range?.high ?? percentile(values, 0.98);
  const span = Math.max(high - low, Number.EPSILON);
  const normalized = new Float32Array(values.length);
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    normalized[index] = Number.isFinite(value)
      ? Math.max(0, Math.min(1, (value - low) / span))
      : 0;
  }
  return { values: normalized, low, high };
}
