import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { loadImageFile } from "../capture/ImageSource";
import { LatestFrameScheduler, type SchedulerState } from "../capture/LatestFrameScheduler";
import { listCameras, startCamera, stopCamera, type CameraOption } from "../capture/WebcamSource";
import { colorizeDepth, type Colormap } from "../depth/colormap";
import type { DepthResult } from "../depth/DepthModelAdapter";
import { normalizeDepth } from "../depth/normalization";
import { OnnxDepthAdapter } from "../depth/OnnxDepthAdapter";
import { relativeProximityToDepth } from "../depth/reconstruction";
import { backprojectToThree } from "../geometry/backproject";
import { degreesToRadians, intrinsicsFromHorizontalFov } from "../geometry/camera";
import { buildPointCloudFromDepth } from "../geometry/pointCloud";
import type { Vec3 } from "../geometry/types";
import type { SpatialViewport } from "../rendering/SpatialViewport";
import { ReconstructionViewport } from "./ReconstructionViewport";

type Status = "idle" | "loading" | "ready" | "running" | "error";
type Preset = "fast" | "balanced" | "inspect";
interface Selection { u: number; v: number; raw: number; depth: number; rgb: [number, number, number]; xyz: Vec3; }
interface LiveFrame { bitmap: ImageBitmap; capturedAt: number; }
interface LiveResult { result: DepthResult; rgb: Uint8Array; }
interface PerformanceStats { inferenceFps: number; renderFps: number; resultAgeMs: number; }

const FIXTURES = [
  { label: "Person", file: "validation-person.png" },
  { label: "Indoor layers", file: "validation-indoor.png" },
  { label: "Glass + reflections", file: "validation-reflective.png" },
  { label: "Thin details", file: "validation-thin-details.png" },
] as const;
const STRIDES: Record<Preset, number> = { fast: 4, balanced: 2, inspect: 1 };

function sampleRgb(source: CanvasImageSource, width: number, height: number): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D is unavailable.");
  context.drawImage(source, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data;
  const rgb = new Uint8Array(width * height * 3);
  for (let pixel = 0; pixel < width * height; pixel++) {
    rgb[pixel * 3] = rgba[pixel * 4];
    rgb[pixel * 3 + 1] = rgba[pixel * 4 + 1];
    rgb[pixel * 3 + 2] = rgba[pixel * 4 + 2];
  }
  return rgb;
}

export function DepthLab({ onSandbox }: { onSandbox: () => void }) {
  const adapter = useRef<OnnxDepthAdapter | null>(null);
  const bitmap = useRef<ImageBitmap | null>(null);
  const resultRef = useRef<DepthResult | null>(null);
  const rgbRef = useRef<Uint8Array | null>(null);
  const rgbCanvas = useRef<HTMLCanvasElement | null>(null);
  const depthCanvas = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<SpatialViewport | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const schedulerRef = useRef<LatestFrameScheduler<LiveFrame, LiveResult> | null>(null);
  const frameCallbackRef = useRef<number | null>(null);
  const frozenRef = useRef(false);
  const inferenceCompletions = useRef<number[]>([]);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [map, setMap] = useState<Colormap>("turbo");
  const [fixedRange, setFixedRange] = useState(false);
  const [preset, setPreset] = useState<Preset>("balanced");
  const [fov, setFov] = useState(60);
  const [near, setNear] = useState(0.7);
  const [far, setFar] = useState(3.5);
  const [depthScale, setDepthScale] = useState(1);
  const [pointSize, setPointSize] = useState(2);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [live, setLive] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [queue, setQueue] = useState<SchedulerState>({ busy: false, pending: false });
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats>({ inferenceFps: 0, renderFps: 0, resultAgeMs: 0 });
  const result = resultRef.current;

  const reconstruction = useMemo(() => {
    if (!result || !rgbRef.current) return null;
    const intrinsics = intrinsicsFromHorizontalFov({ width: result.width, height: result.height, fovXRadians: degreesToRadians(fov) });
    const depth = relativeProximityToDepth(result.values, { near, far, scale: depthScale });
    const buffers = buildPointCloudFromDepth({ depth, width: result.width, height: result.height, colors: rgbRef.current, intrinsics, stride: STRIDES[preset] });
    return { intrinsics, depth, buffers };
  }, [depthScale, far, fov, near, preset, result, revision]);

  useEffect(() => () => {
    schedulerRef.current?.stop(); stopCamera(streamRef.current); bitmap.current?.close(); void adapter.current?.dispose();
    if (frameCallbackRef.current !== null && videoRef.current?.cancelVideoFrameCallback) videoRef.current.cancelVideoFrameCallback(frameCallbackRef.current);
  }, []);
  useEffect(() => {
    let frames = 0; let previous = performance.now(); let raf = 0;
    const tick = () => {
      const now = performance.now();
      frames += 1;
      if (now - previous >= 1000) {
        const recent = inferenceCompletions.current.filter((time) => now - time < 1000);
        inferenceCompletions.current = recent;
        setPerformanceStats((stats) => ({ ...stats, renderFps: frames * 1000 / (now - previous), inferenceFps: recent.length }));
        frames = 0; previous = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    if (!result || !depthCanvas.current) return;
    const normalized = normalizeDepth(result.values, fixedRange ? { low: result.min, high: result.max } : undefined);
    const canvas = depthCanvas.current;
    canvas.width = result.width; canvas.height = result.height;
    canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(colorizeDepth(normalized.values, map)), result.width, result.height), 0, 0);
  }, [fixedRange, map, result, revision]);

  async function ensureModel() {
    if (adapter.current) return adapter.current;
    setStatus("loading");
    const next = new OnnxDepthAdapter();
    await next.load(setProgress); adapter.current = next; setStatus("ready"); return next;
  }
  function acceptResult(result: DepthResult, rgb: Uint8Array, capturedAt?: number) {
    resultRef.current = result; rgbRef.current = rgb;
    inferenceCompletions.current.push(performance.now());
    if (capturedAt !== undefined) setPerformanceStats((stats) => ({ ...stats, resultAgeMs: performance.now() - capturedAt }));
    setRevision((value) => value + 1); setStatus("ready");
  }
  async function openFile(file: File) {
    stopLive();
    setError(""); setSelection(null);
    try {
      bitmap.current?.close(); bitmap.current = await loadImageFile(file);
      const model = await ensureModel(); setStatus("running");
      const result = await model.infer(bitmap.current);
      const rgb = sampleRgb(bitmap.current, result.width, result.height);
      const canvas = rgbCanvas.current;
      if (canvas) { canvas.width = result.width; canvas.height = result.height; canvas.getContext("2d")?.drawImage(bitmap.current, 0, 0, result.width, result.height); }
      acceptResult(result, rgb);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setStatus("error"); }
  }
  async function openExample(file: string) {
    const response = await fetch(`/examples/${file}`);
    if (!response.ok) throw new Error(`Example image returned HTTP ${response.status}`);
    await openFile(new File([await response.blob()], file, { type: "image/png" }));
  }
  function scheduleVideoFrame() {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    const onFrame = async () => {
      if (!frozenRef.current && video.videoWidth > 0) {
        const canvas = rgbCanvas.current;
        if (canvas) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
          canvas.getContext("2d")?.drawImage(video, 0, 0);
        }
        try {
          const frame = await createImageBitmap(video);
          const scheduler = schedulerRef.current;
          if (scheduler) scheduler.submit({ bitmap: frame, capturedAt: performance.now() });
          else frame.close();
        } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
      }
      scheduleVideoFrame();
    };
    frameCallbackRef.current = video.requestVideoFrameCallback
      ? video.requestVideoFrameCallback(() => { void onFrame(); })
      : requestAnimationFrame(() => { void onFrame(); });
  }
  function stopLive() {
    const video = videoRef.current;
    if (frameCallbackRef.current !== null) {
      if (video?.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameCallbackRef.current);
      else cancelAnimationFrame(frameCallbackRef.current);
    }
    frameCallbackRef.current = null; schedulerRef.current?.stop(); schedulerRef.current = null;
    stopCamera(streamRef.current); streamRef.current = null;
    if (video) video.srcObject = null;
    frozenRef.current = false; setFrozen(false); setLive(false); setQueue({ busy: false, pending: false });
  }
  async function startLive(requestedCameraId = cameraId) {
    setError(""); stopLive();
    try {
      const model = await ensureModel();
      const stream = await startCamera(requestedCameraId || undefined); streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video preview is unavailable.");
      video.srcObject = stream; await video.play();
      const available = await listCameras(); setCameras(available);
      const activeId = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (activeId) setCameraId(activeId);
      schedulerRef.current = new LatestFrameScheduler<LiveFrame, LiveResult>(
        async (frame) => {
          setStatus("running");
          const result = await model.infer(frame.bitmap);
          return { result, rgb: sampleRgb(frame.bitmap, result.width, result.height) };
        },
        ({ result, rgb }, frame) => { if (!frozenRef.current) acceptResult(result, rgb, frame.capturedAt); },
        (frame) => frame.bitmap.close(), setQueue,
        (cause) => { setError(cause instanceof Error ? cause.message : String(cause)); setStatus("error"); },
      );
      setLive(true); setPreset("fast"); scheduleVideoFrame();
    } catch (cause) { stopLive(); setError(cause instanceof Error ? cause.message : String(cause)); setStatus("error"); }
  }
  function toggleFreeze() {
    const next = !frozenRef.current; frozenRef.current = next; setFrozen(next); setPreset(next ? "inspect" : "fast");
  }
  function pick(event: MouseEvent<HTMLCanvasElement>) {
    if (!result || !rgbRef.current || !reconstruction) return;
    const rect = event.currentTarget.getBoundingClientRect();
    let u = Math.min(result.width - 1, Math.max(0, Math.floor((event.clientX - rect.left) / rect.width * result.width)));
    if (event.currentTarget === rgbCanvas.current && live && mirror) u = result.width - 1 - u;
    const v = Math.min(result.height - 1, Math.max(0, Math.floor((event.clientY - rect.top) / rect.height * result.height)));
    const index = v * result.width + u; const colorIndex = index * 3;
    const depth = reconstruction.depth[index];
    setSelection({ u, v, raw: result.values[index], depth, rgb: [rgbRef.current[colorIndex], rgbRef.current[colorIndex + 1], rgbRef.current[colorIndex + 2]], xyz: backprojectToThree(u, v, depth, reconstruction.intrinsics) });
  }
  function resetReconstruction() { setPreset("balanced"); setFov(60); setNear(0.7); setFar(3.5); setDepthScale(1); setPointSize(2); setSelection(null); }

  return <div className="depth-lab milestone-two">
    <main className="spatial-stage">
      <div className="source-strip">
        <figure><canvas className={live && mirror ? "mirrored" : ""} ref={rgbCanvas} onClick={pick} /><figcaption>RGB source · click to inspect</figcaption></figure>
        <figure><canvas ref={depthCanvas} onClick={pick} /><figcaption>Relative proximity · {map}</figcaption></figure>
      </div>
      {reconstruction ? <ReconstructionViewport {...reconstruction} pointSize={pointSize} viewportRef={viewportRef} /> : <div className="empty-state">Choose a validation image to build its point cloud.</div>}
      <video className="capture-video" ref={videoRef} muted playsInline />
    </main>
    <aside className="panel">
      <p className="eyebrow">Milestone 3</p><h1>Live spatial viewer</h1>
      <p className="lede">Image or webcam → relative depth → RGB-aligned 2.5D geometry. Processing stays on-device.</p>
      <section><h2>Source</h2>
        <label className="file-button">Open image<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void openFile(file); }} /></label>
        <div className="fixture-grid">{FIXTURES.map((fixture) => <button key={fixture.file} type="button" onClick={() => void openExample(fixture.file)}>{fixture.label}</button>)}</div>
        <div className="camera-controls">
          {cameras.length > 0 && <label className="row"><span>Camera</span><select value={cameraId} onChange={(event) => { setCameraId(event.target.value); if (live) void startLive(event.target.value); }}>{cameras.map((camera) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label}</option>)}</select></label>}
          <div className="actions"><button type="button" onClick={() => live ? stopLive() : void startLive()}>{live ? "Stop camera" : "Use webcam"}</button><button type="button" disabled={!live} onClick={toggleFreeze}>{frozen ? "Resume" : "Freeze"}</button></div>
          <label className="check"><input type="checkbox" checked={mirror} onChange={(event) => setMirror(event.target.checked)} />Mirror RGB preview only</label>
        </div>
      </section>
      <section><h2>Reconstruction</h2>
        <div className="preset-row">{(["fast", "balanced", "inspect"] as const).map((item) => <button className={preset === item ? "active" : ""} key={item} onClick={() => setPreset(item)}>{item}</button>)}</div>
        <label className="range-label"><span>Horizontal FOV <strong>{fov}°</strong></span><input type="range" min="25" max="110" value={fov} onChange={(e) => setFov(Number(e.target.value))} /></label>
        <label className="range-label"><span>Depth scale <strong>{depthScale.toFixed(1)}×</strong></span><input type="range" min="0.2" max="3" step="0.1" value={depthScale} onChange={(e) => setDepthScale(Number(e.target.value))} /></label>
        <label className="range-label"><span>Near depth <strong>{near.toFixed(1)}</strong></span><input type="range" min="0.1" max="2" step="0.1" value={near} onChange={(e) => setNear(Math.min(Number(e.target.value), far - 0.1))} /></label>
        <label className="range-label"><span>Far depth <strong>{far.toFixed(1)}</strong></span><input type="range" min="1" max="8" step="0.1" value={far} onChange={(e) => setFar(Math.max(Number(e.target.value), near + 0.1))} /></label>
        <label className="range-label"><span>Point size <strong>{pointSize}px</strong></span><input type="range" min="1" max="6" value={pointSize} onChange={(e) => setPointSize(Number(e.target.value))} /></label>
        <div className="actions"><button onClick={() => viewportRef.current?.resetToSourceCamera()}>Source camera</button><button onClick={() => viewportRef.current?.resetToInspectView()}>Inspect view</button></div>
        <button className="ghost" onClick={resetReconstruction}>Reset reconstruction</button>
      </section>
      <section><h2>Depth display</h2><label className="row"><span>Colormap</span><select value={map} onChange={(e) => setMap(e.target.value as Colormap)}><option value="grayscale">Grayscale</option><option value="turbo">Turbo</option><option value="inferno">Inferno</option></select></label><label className="check"><input type="checkbox" checked={fixedRange} onChange={(e) => setFixedRange(e.target.checked)} />Fixed raw min/max</label></section>
      <section><h2>Inspector</h2><dl className="stats">
        <div><dt>Status</dt><dd>{frozen ? "frozen" : status}{status === "loading" ? ` ${Math.round(progress * 100)}%` : ""}</dd></div><div><dt>Backend</dt><dd>{result?.backend ?? "—"}</dd></div><div><dt>Tensor</dt><dd>{result ? `${result.width} × ${result.height}` : "—"}</dd></div><div><dt>Points</dt><dd>{reconstruction?.buffers.validVertexCount.toLocaleString() ?? "—"}</dd></div>
        <div><dt>Pixel</dt><dd>{selection ? `${selection.u}, ${selection.v}` : "—"}</dd></div><div><dt>RGB</dt><dd>{selection?.rgb.join(", ") ?? "—"}</dd></div><div><dt>Raw proximity</dt><dd>{selection?.raw.toFixed(4) ?? "—"}</dd></div><div><dt>Relative depth</dt><dd>{selection?.depth.toFixed(4) ?? "—"}</dd></div><div><dt>XYZ</dt><dd>{selection ? `${selection.xyz.x.toFixed(2)}, ${selection.xyz.y.toFixed(2)}, ${selection.xyz.z.toFixed(2)}` : "—"}</dd></div>
      </dl>{error && <p className="error">{error}</p>}</section>
      <button className="ghost" onClick={onSandbox}>Geometry sandbox</button><p className="hint">Units are relative scene units, not meters. Reconstruction controls reuse the existing depth result and never rerun inference.</p>
    </aside>
    <footer className="performance-strip"><span>Inference <strong>{performanceStats.inferenceFps.toFixed(1)} FPS</strong></span><span>Render <strong>{performanceStats.renderFps.toFixed(0)} FPS</strong></span><span>Result age <strong>{performanceStats.resultAgeMs.toFixed(0)} ms</strong></span><span>Queue <strong>{queue.busy ? (queue.pending ? "busy + latest" : "busy") : "idle"}</strong></span><span>{result ? `${result.width} × ${result.height}` : "no result"}</span></footer>
  </div>;
}
