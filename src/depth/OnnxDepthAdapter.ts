import * as ort from "onnxruntime-web";
import type { DepthModelAdapter, DepthResult } from "./DepthModelAdapter";

const STILL_SHORT_SIDE = 518;
export const LIVE_SHORT_SIDE = 280;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

export class OnnxDepthAdapter implements DepthModelAdapter {
  private session: ort.InferenceSession | null = null;
  private backend: "webgpu" | "wasm" = "wasm";
  private shortSide = STILL_SHORT_SIDE;
  private readonly canvas = document.createElement("canvas");
  private input = new Float32Array();

  constructor(private readonly modelUrl = "/models/depth-anything-v2-small-q4f16.onnx") {}

  setInputShortSide(shortSide: number): void {
    this.shortSide = Math.max(140, Math.round(shortSide / 14) * 14);
  }

  useStillQuality(): void {
    this.shortSide = STILL_SHORT_SIDE;
  }

  async load(onProgress?: (progress: number) => void): Promise<void> {
    onProgress?.(0.05);
    const providers: Array<"webgpu" | "wasm"> = "gpu" in navigator ? ["webgpu", "wasm"] : ["wasm"];
    try {
      this.session = await ort.InferenceSession.create(this.modelUrl, {
        executionProviders: providers,
        graphOptimizationLevel: "all",
      });
      this.backend = providers[0];
    } catch (error) {
      if (providers[0] !== "webgpu") throw error;
      this.session = await ort.InferenceSession.create(this.modelUrl, {
        executionProviders: ["wasm"], graphOptimizationLevel: "all",
      });
      this.backend = "wasm";
    }
    onProgress?.(1);
  }

  async infer(source: ImageBitmap): Promise<DepthResult> {
    if (!this.session) throw new Error("Load the model before inference.");
    const sourceWidth = source.width;
    const sourceHeight = source.height;
    const scale = this.shortSide / Math.min(sourceWidth, sourceHeight);
    const width = Math.round((sourceWidth * scale) / 14) * 14;
    const height = Math.round((sourceHeight * scale) / 14) * 14;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    const context = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas 2D is unavailable.");
    context.drawImage(source, 0, 0, width, height);
    const rgba = context.getImageData(0, 0, width, height).data;
    const planeSize = width * height;
    if (this.input.length !== 3 * planeSize) this.input = new Float32Array(3 * planeSize);
    const input = this.input;
    for (let pixel = 0; pixel < planeSize; pixel++) {
      for (let channel = 0; channel < 3; channel++) {
        input[channel * planeSize + pixel] = (rgba[pixel * 4 + channel] / 255 - MEAN[channel]) / STD[channel];
      }
    }
    const started = performance.now();
    const outputs = await this.session.run({ pixel_values: new ort.Tensor("float32", input, [1, 3, height, width]) });
    const inferenceMs = performance.now() - started;
    const tensor = outputs.predicted_depth ?? Object.values(outputs)[0];
    const data = await tensor.getData();
    const values = data instanceof Float32Array ? data.slice() : Float32Array.from(data as ArrayLike<number>);
    let min = Infinity;
    let max = -Infinity;
    for (const value of values) if (Number.isFinite(value)) { min = Math.min(min, value); max = Math.max(max, value); }
    const dims = tensor.dims;
    return { width: Number(dims[dims.length - 1]), height: Number(dims[dims.length - 2]), values, kind: "relative-depth", min, max, inferenceMs, backend: this.backend };
  }

  async dispose(): Promise<void> {
    await this.session?.release();
    this.session = null;
  }
}
