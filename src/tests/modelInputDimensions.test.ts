import { describe, expect, it } from "vitest";
import { modelInputDimensions } from "../depth/OnnxDepthAdapter";

describe("modelInputDimensions", () => {
  it("preserves landscape aspect ratio on the model patch grid", () => {
    expect(modelInputDimensions(1920, 1080, 196)).toEqual({ width: 350, height: 196 });
  });

  it("preserves portrait orientation on the model patch grid", () => {
    expect(modelInputDimensions(1080, 1920, 196)).toEqual({ width: 196, height: 350 });
  });
});
