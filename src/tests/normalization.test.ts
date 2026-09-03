import { describe, expect, it } from "vitest";
import { normalizeDepth, percentile } from "../depth/normalization";

describe("depth normalization", () => {
  it("interpolates percentiles and ignores invalid values", () => {
    expect(percentile(new Float32Array([0, 10, 20, Number.NaN]), 0.5)).toBe(10);
  });
  it("clips values to a fixed range", () => {
    expect(Array.from(normalizeDepth(new Float32Array([-1, 0, 5, 10, 11]), { low: 0, high: 10 }).values)).toEqual([0, 0, 0.5, 1, 1]);
  });
});
