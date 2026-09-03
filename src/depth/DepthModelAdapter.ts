export type DepthKind = "depth" | "inverse-depth" | "relative-depth";

export interface DepthResult {
  width: number;
  height: number;
  values: Float32Array;
  kind: DepthKind;
  min: number;
  max: number;
  inferenceMs: number;
  backend: "webgpu" | "wasm";
}

export interface DepthModelAdapter {
  load(onProgress?: (progress: number) => void): Promise<void>;
  infer(source: ImageBitmap): Promise<DepthResult>;
  dispose(): Promise<void>;
}
