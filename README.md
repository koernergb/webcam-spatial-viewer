# Parallax Lab

Privacy-preserving browser spatial viewer: webcam or image → on-device monocular
depth → inspectable point cloud and discontinuity-aware 2.5D mesh.

Parallax Lab runs Depth Anything V2 Small through ONNX Runtime Web using WebGPU
with a WASM fallback. Frames stay in the browser. The result is **relative,
single-view geometry**, not metric depth, a complete scan, or SLAM.

## Run

```bash
npm install
npm test
npm run dev
```

Open the printed local URL. Choose a fixture, upload an image, or grant webcam
access. Drag to orbit, scroll to zoom, and use **Freeze** for full-density live
inspection.

## What it does

- Preserves source aspect ratio while running `518px` still-image inference and a
  dedicated `196px` low-latency webcam path.
- Displays aligned RGB and robust-normalized relative proximity.
- Back-projects depth through an adjustable pinhole camera into Three.js space.
- Renders points, solid mesh, wireframe, normal debug, and rejected triangles.
- Rejects triangles across relative depth jumps and excessive 3D edge lengths.
- Uses latest-frame-wins scheduling: one inference plus at most one pending frame.
- Reports inference FPS, render FPS, result age, resolution, and queue state.
- Exports point/mesh ASCII PLY, colored mesh GLB, and viewport PNG screenshots.

## Pipeline

```text
image / webcam
  → aspect-preserving RGB tensor preprocessing
  → Depth Anything V2 Small (WebGPU, WASM fallback)
  → relative-proximity tensor
  → robust depth conversion
  → pinhole back-projection
  → RGB points + discontinuity-aware grid mesh
  → Three.js renderer / PLY / GLB
```

Large depth, color, and geometry buffers stay outside React state. Three.js owns
GPU objects and updates buffer attributes from typed arrays. Model-specific tensor
names, normalization, and output semantics are isolated in
`src/depth/OnnxDepthAdapter.ts`.

## Geometry

For image pixel `(u, v)` and relative camera depth `z`:

```text
x = (u - cx) z / fx
y = (v - cy) z / fy
```

The image convention is +X right, +Y down, camera +Z forward. Conversion happens
once at the Three.js boundary: world X = camera X, world Y = −camera Y, world Z =
−camera Z. The viewer therefore looks toward world −Z. Full conventions are in
[`src/geometry/README.md`](src/geometry/README.md).

Depth Anything emits relative proximity, where larger values generally indicate
nearer surfaces. Parallax Lab robust-normalizes that output and maps it
monotonically into a user-controlled positive relative depth range. These values
are deliberately labeled **relative scene units**.

The mesh treats sampled depth as a regular grid and proposes two consistently
wound triangles per cell. A triangle is rejected if a vertex is invalid, its
relative depth jump exceeds the threshold, or its longest 3D edge is too large.
Holes at silhouettes are intentional and preferable to foreground/background
“flying triangles.”

## Controls and exports

- **Fast / Balanced / Inspect:** sampling strides 4 / 2 / 1.
- **FOV, scale, near/far, thresholds:** rebuild geometry without rerunning inference.
- **Rejected triangles:** overlays rejected candidates in red wireframe for diagnosis.
- **Point PLY:** compact RGB point cloud in Three.js coordinates.
- **Mesh PLY / GLB:** accepted triangles only, with vertex colors. GLB metadata marks
  the scale as relative and the reconstruction as single-view 2.5D.

Verify exports in Blender, MeshLab, or another external viewer before using them
downstream; coordinate conventions are documented but not all tools choose the
same default camera orientation.

## Performance and privacy

Live RGB follows the camera callback while depth updates at inference speed. If
inference is busy, any older pending bitmap is released and replaced by the newest
frame, keeping latency bounded. Webcam frames are downsampled once at capture,
before bitmap creation, so full camera-resolution frames never enter the inference
queue. Point mode also skips mesh construction until a mesh view or export needs
it. Stop/unmount releases media tracks, pending
bitmaps, Three.js resources, and the ONNX session.

No frame upload endpoint exists. The only runtime assets fetched are local model,
WASM, and bundled example files served with the application.

## Known failure modes

- Reflective and transparent surfaces can receive inconsistent depth.
- Thin structures, hair, cables, and leaves may disappear or merge.
- Textureless surfaces may become over-smoothed.
- Per-image relative scaling prevents direct metric comparison between scenes.
- A single view contains only camera-visible surfaces; orbiting reveals the 2.5D
  nature of the reconstruction and cannot reveal hidden geometry.
- Incorrect assumed FOV changes reconstructed shape.
- Quantized model output trades some quality for browser size and speed.

The bundled gallery intentionally includes person silhouettes, strong indoor depth
layers, reflective/transparent objects, and thin structures. The images are
AI-generated validation fixtures, not training data or benchmark claims.

## Non-goals

V1 does not perform metric calibration, multi-frame fusion, camera tracking, loop
closure, room scanning, WebXR, or novel-view synthesis. Those are separate
research extensions, not implied capabilities.

Implementation plan: [`milestones.md`](milestones.md). Original product brief:
[`Webcam_Spatial_Viewer_Build_Brief.md`](Webcam_Spatial_Viewer_Build_Brief.md).
