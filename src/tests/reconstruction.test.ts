import { describe, expect, it } from "vitest";
import { relativeProximityToDepth } from "../depth/reconstruction";

describe("relative proximity conversion", () => {
  it("maps larger proximity nearer", () => {
    expect(Array.from(relativeProximityToDepth(new Float32Array([0, 5, 10]), { near: 1, far: 3 }))).toEqual([3, 2, 1]);
  });
  it("applies scale and preserves invalid samples", () => {
    const depth = relativeProximityToDepth(new Float32Array([0, Number.NaN, 10]), { near: 1, far: 2, scale: 2 });
    expect(depth[0]).toBe(4);
    expect(Number.isNaN(depth[1])).toBe(true);
    expect(depth[2]).toBe(2);
  });
  it("rejects invalid ranges", () => {
    expect(() => relativeProximityToDepth(new Float32Array([1]), { near: 2, far: 1 })).toThrow();
  });
});
