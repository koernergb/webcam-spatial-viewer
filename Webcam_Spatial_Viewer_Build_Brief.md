# Webcam Spatial Viewer

## Implementation Build Brief

**Working title:** Parallax Lab  
**Project type:** Browser-based real-time 3D perception and visualization tool  
**Primary stack:** TypeScript, React, Three.js, Web Workers, ONNX Runtime Web  
**Target hardware:** Modern desktop browser, with Apple Silicon Mac as the primary development target  
**Core promise:** Turn a normal webcam frame into an inspectable depth map, colored point cloud, and depth-derived mesh without uploading the video.

---

## 1. Product concept

Parallax Lab is an interactive spatial-perception viewer. A user grants webcam access and sees four synchronized representations of the same scene:

1. RGB camera image.
2. Estimated monocular depth.
3. Orbitable RGB-colored point cloud.
4. Depth-derived triangle mesh.

The application is both a visual demo and a technical debugger. It should expose the assumptions and intermediate representations rather than hiding everything behind a polished effect. A user can select a pixel, inspect its estimated depth and reconstructed 3D position, adjust reconstruction parameters, freeze a frame, and export the resulting geometry.

The initial version is explicitly **single-frame 2.5D reconstruction**, not room scanning, SLAM, or metrically accurate 3D capture. Temporal fusion is a later experimental branch.

### Why this project is worth building

It creates an unusually tight visual feedback loop while developing skills relevant to browser graphics, perception, XR, and neural rendering:

- Webcam and browser media APIs
- Model inference and tensor preprocessing
- Pinhole-camera geometry
- GPU-friendly point rendering
- Mesh construction from depth
- Coordinate-system debugging
- Real-time performance profiling
- Technical visualization and interaction design

The finished artifact should make a stronger portfolio piece than a generic model demo because it explains and visualizes the complete pixels-to-geometry pipeline.

---

## 2. Project goals

### Primary goals

- Run monocular depth inference on webcam frames.
- Keep frames on-device; no server upload is required.
- Convert the depth map to an interactive colored point cloud.
- Generate a depth-aware triangle mesh from the same frame.
- Maintain a responsive interface even when inference is slower than the camera.
- Expose camera parameters, thresholds, performance, and reconstruction state.
- Export a frozen reconstruction as PLY and, later, glTF.
- Document predictable failure modes rather than implying scanner-grade accuracy.

### Secondary goals

- Support uploaded images in addition to webcam input.
- Provide several depth colormaps.
- Offer high-quality and high-performance presets.
- Save screenshots and small reconstruction artifacts.
- Make the core geometry code reusable in a future WebXR project.

### Non-goals for the initial release

- Metric depth without calibration or an external scale reference
- Multi-room scanning
- Dense SLAM
- Loop closure
- Dynamic-scene reconstruction across time
- Mobile optimization
- Training a new depth model
- Photorealistic novel-view synthesis
- Reconstructing geometry behind occluded surfaces

These exclusions are important. A monocular depth map describes the visible surfaces from one viewpoint. Calling it a complete 3D scan would overstate what the system does.

---

## 3. Intended user experience

### First run

1. User opens the application.
2. A concise privacy notice states that processing occurs locally.
3. User chooses **Use webcam** or **Open image**.
4. The application loads the model and reports progress.
5. RGB and depth views begin updating.
6. The point-cloud viewport appears as soon as the first valid depth result arrives.
7. The user can drag to orbit, scroll to zoom, and press **Freeze** to inspect one frame.

### Exploration workflow

While frozen, the user can:

- Click an RGB or depth pixel.
- See pixel coordinates, raw model depth, normalized depth, confidence if available, and reconstructed XYZ.
- Change the assumed horizontal field of view.
- Change near/far clipping and depth scaling.
- Adjust point size and sampling density.
- Toggle RGB color, depth color, and normals.
- Switch between points, solid mesh, and wireframe.
- Export the current reconstruction.

### Layout

Desktop layout:

- Left column: RGB and depth panels.
- Center/right: large Three.js viewport.
- Right inspector or collapsible drawer: controls and selected-point data.
- Bottom compact strip: inference, render, memory, resolution, and queue statistics.

On narrow screens, stack the panels and treat the 3D viewport as the primary surface. Mobile performance is not an initial acceptance requirement.

---

## 4. Recommended technical architecture

```text
Media source
  -> frame sampler
  -> preprocessing worker
  -> depth inference
  -> depth postprocessing
  -> latest-result buffer
  -> point-cloud / mesh builder
  -> Three.js renderer
  -> inspector and export tools
```

### Front end

- React with TypeScript for UI and application state.
- Vite for development and production bundling.
- Three.js directly or through React Three Fiber. Prefer direct Three.js if the purpose is to demonstrate graphics fundamentals; prefer React Three Fiber if iteration speed is more valuable.
- A lightweight store such as Zustand for user-facing state. Do not put large pixel or vertex buffers into React state.
- Web Workers for preprocessing, geometry construction, and export serialization when profiling shows main-thread stalls.

### Model runtime

Use an exported, browser-compatible monocular-depth model through ONNX Runtime Web. Start with WebGPU execution where supported and retain WASM as a fallback. Select a small model first; model quality is less valuable than a stable interactive pipeline during the first milestones.

The model adapter must isolate model-specific behavior:

```ts
interface DepthModelAdapter {
  load(options: LoadOptions): Promise<void>;
  infer(frame: ImageBitmap): Promise<DepthResult>;
  dispose(): Promise<void>;
}

interface DepthResult {
  width: number;
  height: number;
  values: Float32Array;
  kind: "depth" | "inverse-depth" | "relative-depth";
  min: number;
  max: number;
  inferenceMs: number;
  confidence?: Float32Array;
}
```

This prevents preprocessing, tensor names, output orientation, and inverse-depth conventions from leaking throughout the application.

### Rendering boundary

Three.js owns GPU objects. The rest of the application supplies typed arrays:

```ts
interface ReconstructionBuffers {
  positions: Float32Array;
  colors: Uint8Array | Float32Array;
  indices?: Uint32Array;
  validVertexCount: number;
  validTriangleCount?: number;
}
```

Reuse `BufferGeometry` and update attributes in place when capacity permits. Do not recreate the entire Three.js scene on each depth result.

---

## 5. Repository structure

```text
parallax-lab/
  public/
    models/
    examples/
  src/
    app/
      App.tsx
      routes.ts
    capture/
      WebcamSource.ts
      ImageSource.ts
      FrameSampler.ts
    depth/
      DepthModelAdapter.ts
      OnnxDepthAdapter.ts
      preprocess.ts
      postprocess.ts
      normalization.ts
    geometry/
      camera.ts
      backproject.ts
      pointCloud.ts
      depthMesh.ts
      normals.ts
    rendering/
      SpatialViewport.ts
      PointCloudRenderer.ts
      MeshRenderer.ts
      CameraFrustum.ts
      Picking.ts
    workers/
      inference.worker.ts
      geometry.worker.ts
      export.worker.ts
    export/
      ply.ts
      gltf.ts
      screenshot.ts
    state/
      viewerStore.ts
      settings.ts
    ui/
      SourcePanel.tsx
      DepthPanel.tsx
      Inspector.tsx
      PerformanceStrip.tsx
      ExportDialog.tsx
    diagnostics/
      timings.ts
      memory.ts
      validation.ts
    tests/
      fixtures/
      backproject.test.ts
      depthMesh.test.ts
      ply.test.ts
  README.md
  vite.config.ts
```

Avoid premature worker complexity. Establish correctness synchronously on frozen images, then move measured bottlenecks off the main thread.

---

## 6. Core geometry

### Camera model

For a pixel at image coordinate \((u,v)\) and depth \(z\), use the pinhole model:

\[
x = (u-c_x)z/f_x
\]

\[
y = (v-c_y)z/f_y
\]

\[
Z = z
\]

For an initial uncalibrated webcam, assume:

- Principal point at the image center.
- Square pixels: \(f_x \approx f_y\), adjusted for aspect ratio as needed.
- User-adjustable horizontal field of view.

Convert horizontal field of view to focal length:

\[
f_x = \frac{W}{2\tan(\mathrm{FOV}_x/2)}
\]

The initial reconstruction has an arbitrary scale because typical monocular models output relative or affine-invariant depth. Label all units as **relative scene units** unless the user performs a scale calibration.

### Coordinate conventions

Choose and document one convention at the geometry boundary:

- Image origin: top-left.
- Image +x: right.
- Image +y: down.
- Camera looks along a clearly stated axis.
- Three.js world: +x right, +y up; apply the necessary y/z sign conversion once.

Add a visible XYZ axis helper and an optional camera frustum. Mirrored or upside-down reconstructions are common integration errors and should be caught immediately.

### Depth normalization

Depth models may output depth, inverse depth, disparity-like values, or arbitrary relative depth. The adapter should convert outputs into one documented monotonic representation before geometry generation.

Provide two display transformations:

- Robust min/max using percentiles, such as the 2nd and 98th percentiles.
- Fixed range when comparing multiple frozen examples.

Do not normalize every frame independently without indicating it. Per-frame normalization can create apparent depth pumping even when the underlying prediction changes only slightly.

### Point-cloud construction

For every sampled valid pixel:

1. Read normalized or reconstructed depth.
2. Reject NaN, infinity, and clipped values.
3. Back-project to XYZ.
4. Copy corresponding RGB values.
5. Write into preallocated typed arrays.

Initial density presets:

- Fast: every fourth pixel in x and y.
- Balanced: every second pixel.
- Full: every pixel, intended primarily for frozen frames.

Use a `THREE.Points` object with `BufferGeometry`. Start with `PointsMaterial`; add a small custom shader later for circular splats, depth-dependent size, and confidence-based opacity.

### Mesh construction

Treat the depth image as a regular grid. Every four neighboring samples form two candidate triangles. Reject a triangle when:

- Any vertex is invalid.
- Absolute or relative depth difference exceeds a threshold.
- Its longest 3D edge exceeds a threshold.
- Its normal faces an implausible direction, if normal filtering is enabled.

The relative discontinuity test can be expressed as:

\[
\frac{z_{max}-z_{min}}{\max(z_{min}, \epsilon)} < \tau
\]

Start with threshold \(\tau\) exposed in the UI. This prevents the mesh from creating long sheets between foreground objects and the background.

Compute vertex normals only after topology is correct. Provide a normal-debug visualization because black or oddly lit surfaces frequently result from reversed winding or coordinate conversion errors.

---

## 7. Real-time execution model

The webcam may provide 30 or 60 FPS, while browser depth inference may run much more slowly. Do not queue every frame.

Use a **latest-frame-wins** policy:

1. Capture frames continuously for RGB display.
2. If inference is idle, submit the newest available frame.
3. While inference runs, replace the pending frame rather than enqueueing more work.
4. When inference finishes, render its result and immediately process the newest pending frame.

This keeps latency bounded and prevents the spatial view from drifting seconds behind the live camera.

Track these timestamps separately:

- Frame capture
- Preprocessing
- Inference
- Postprocessing
- Geometry generation
- GPU upload
- Render
- End-to-end result age

The performance display should report both inference FPS and render FPS. Reporting only render FPS would make a 60 FPS viewport with 3 FPS depth updates look deceptively fast.

### Adaptive quality

After the baseline works, support a conservative adaptive mode:

- Lower model input resolution if result age remains above a threshold.
- Reduce point density while the camera is live.
- Restore higher density after Freeze.
- Avoid changing several parameters simultaneously; display what adaptation occurred.

---

## 8. UI specification

### Source panel

- Start/stop camera
- Camera selector
- Upload image
- Mirror preview toggle
- Capture resolution
- Freeze/resume
- Model load state and errors

Mirroring should be a display choice. Ensure the depth map and geometry use consistent pixel coordinates regardless of whether the selfie preview is mirrored.

### Depth panel

- RGB/depth split or swipe comparison
- Grayscale, turbo, and inferno-like colormaps
- Raw versus robust-normalized display
- Near/far percentile controls
- Selected-pixel marker
- Depth legend labeled as relative unless calibrated

### Spatial viewport

- Orbit, pan, and zoom
- Reset to source camera
- Points/mesh/wireframe modes
- RGB/depth/normal coloring
- Background color
- Point size
- Grid, axes, and camera-frustum toggles
- Screenshot

### Inspector

- Pixel \((u,v)\)
- RGB value
- Raw model output
- Converted depth
- Reconstructed XYZ
- Validity/rejection reason
- Assumed intrinsics
- Triangle count and point count

### Reconstruction controls

- Horizontal FOV
- Depth scale
- Depth offset if the representation permits it
- Near and far clipping
- Sampling stride
- Discontinuity threshold
- Maximum edge length
- Mesh smoothing off by default

Every control needs a reset button. Include three presets: **Fast**, **Balanced**, and **Inspect**.

---

## 9. Milestones and acceptance criteria

### Milestone 0 — Geometry sandbox

**Duration:** 1–2 days

Before model integration, generate a synthetic depth plane and a synthetic sphere-like depth field.

Tasks:

- Implement camera intrinsics from FOV.
- Back-project synthetic depth to points.
- Render with Three.js.
- Verify axes, orientation, aspect ratio, and point colors.
- Unit-test known pixels and expected XYZ values.

Acceptance criteria:

- Center pixel reconstructs on the camera axis.
- Symmetric pixels reconstruct symmetrically.
- Changing FOV visibly produces the expected widening/narrowing.
- No dependency on a neural model is required to validate geometry.

### Milestone 1 — Frozen-image depth laboratory

**Duration:** 3–5 days

Tasks:

- Load a local example image.
- Load the depth model.
- Implement preprocessing and postprocessing.
- Render depth as a 2D colormap.
- Display timing and tensor dimensions.
- Add a fixture set with indoor, person, object, and difficult reflective scenes.

Acceptance criteria:

- The model loads with understandable progress/error state.
- Inference succeeds repeatedly without memory growth.
- Input/output orientation is correct.
- Depth ordering is visually sensible on ordinary scenes.
- Raw and normalized outputs can be inspected.

### Milestone 2 — Colored point cloud

**Duration:** 3–5 days

Tasks:

- Back-project model depth.
- Attach source RGB colors.
- Add orbit controls and reset-to-camera.
- Add sampling density, point size, depth scale, clipping, and FOV controls.
- Implement pixel picking and XYZ inspection.

Acceptance criteria:

- A frozen image becomes an orbitable, correctly oriented point cloud.
- RGB alignment remains correct at all supported sampling strides.
- Parameter changes update without re-running inference when possible.
- The center-pixel test remains correct.

This is the first portfolio-worthy release. Publish it before adding live inference.

### Milestone 3 — Live webcam pipeline

**Duration:** 3–6 days

Tasks:

- Add secure-context webcam permission flow.
- Use `requestVideoFrameCallback` when available.
- Implement latest-frame-wins scheduling.
- Add freeze/resume.
- Separate RGB render rate from inference rate.
- Add performance and result-age measurements.

Acceptance criteria:

- The UI stays responsive during sustained inference.
- The inference queue never grows without bound.
- Freeze produces a stable high-density point cloud.
- Camera stop and component unmount release media tracks and model resources.
- Webcam frames are not sent to a server.

### Milestone 4 — Depth-aware mesh

**Duration:** 4–7 days

Tasks:

- Generate grid topology.
- Reject triangles at depth discontinuities.
- Add solid, wireframe, and normal modes.
- Compute normals.
- Move geometry construction to a worker if profiling justifies it.

Acceptance criteria:

- Foreground silhouettes do not routinely connect to distant backgrounds.
- Mesh winding and normals are correct.
- Threshold controls update topology predictably.
- The application reports the number and percentage of rejected triangles.

### Milestone 5 — Export and presentation

**Duration:** 3–5 days

Tasks:

- Export point clouds to binary or ASCII PLY; start with ASCII for debuggability.
- Export mesh to glTF/GLB.
- Include coordinate and relative-scale metadata when the format permits.
- Add example gallery and failure-mode annotations.
- Write architecture and geometry explanation.
- Record a short demo video.

Acceptance criteria:

- PLY opens with correct color and orientation in an external viewer.
- Mesh export opens with correct geometry and texture/color treatment.
- README clearly states that monocular depth is relative and single-view geometry is incomplete.
- A visitor can understand the project within 30 seconds and inspect technical details within two minutes.

---

## 10. Testing strategy

### Unit tests

- FOV-to-focal-length conversion
- Back-projection of center and corner pixels
- Coordinate conversion into Three.js space
- Depth/inverse-depth conversion
- Percentile normalization
- Invalid-depth filtering
- Triangle construction and winding
- Depth-discontinuity rejection
- PLY header counts and vertex serialization

### Golden-image tests

Keep a small set of versioned fixtures with known depth outputs or recorded adapter outputs. Test geometry independently of model-runtime changes.

For each fixture, record:

- Depth dimensions
- Valid point count
- Triangle count at a fixed threshold
- Bounds of reconstructed geometry
- A small hash or numeric summary of selected samples

Avoid requiring exact equality for all floating-point model output across GPU backends.

### Visual checks

- Straight wall remains approximately planar.
- Person silhouette is separated from background.
- RGB colors align with point positions.
- Image is neither transposed nor mirrored unexpectedly.
- Mesh has no widespread inverted normals.
- Changing FOV alters shape without corrupting topology.

### Performance tests

Measure sustained behavior for at least five minutes:

- Memory trend
- Inference latency distribution, not only average
- Result age
- Geometry-build time
- GPU upload time
- Interaction responsiveness during inference

---

## 11. Failure modes to design for

### Relative depth mistaken for meters

Label units honestly. Add an optional calibration flow later: the user selects two image points on an object with a known size and supplies its real measurement. Even then, explain that one scale factor does not remove all monocular-depth distortion.

### Inverse-depth inversion

If near objects appear farther away, inspect model semantics before adding arbitrary sign flips. Keep a test image with an obvious foreground subject.

### Mirrored webcam mismatch

The selfie preview may be mirrored while inference uses the unmirrored frame. Centralize all mirroring and UV conversion.

### Main-thread stalls

First reduce inference frequency and geometry density. Then profile. Move preprocessing or geometry generation to workers only after identifying the stall.

### Memory leaks

Common causes include unreleased `ImageBitmap` objects, retained tensors, repeatedly allocated GPU buffers, undisposed Three.js materials/geometries, and orphaned webcam streams.

### Depth flicker

Per-frame relative-depth scaling can fluctuate. For live mode, optionally smooth robust range statistics and depth values, but retain an unsmoothed toggle so temporal filtering does not conceal model behavior.

### Flying triangles

Use both relative depth and maximum 3D edge thresholds. Expose rejected triangles in a debug color mode.

### Cross-origin isolation or backend incompatibility

Detect WebGPU availability, show the selected backend, and provide a WASM fallback. Fail with a useful explanation instead of an empty canvas.

---

## 12. Performance budget

Initial targets are intentionally hardware-relative:

- UI interaction and orbit controls: visually smooth, ideally 60 FPS.
- Live depth updates: useful at 5+ FPS; acceptable at lower rates if result age stays bounded and the interface communicates it.
- Frozen point cloud: at least several hundred thousand points on a modern laptop without unusable interaction.
- Parameter adjustment that does not require inference: perceptual response under 100 ms for balanced density where feasible.
- No sustained memory growth during a five-minute webcam session.

Treat these as profiling targets, not marketing claims. Record the browser, backend, device, model, input resolution, and sampling stride with every benchmark.

---

## 13. Optional extensions

### A. Metric-scale calibration

Allow the user to mark an object of known width or provide camera intrinsics. Use this to establish an approximate global scale and explain the remaining ambiguity.

### B. Temporal stabilization

Apply optical flow or simple image-space correspondence to stabilize depth between neighboring frames. Compare raw and stabilized output side by side.

### C. Camera pose and accumulation

This is a separate experimental phase, not an ordinary feature. Estimate camera motion, transform reconstructions into a shared frame, and accumulate them.

Required additions:

- Pose estimator or visual odometry
- Scale-alignment strategy
- Depth alignment across frames
- Confidence-weighted fusion
- Dynamic-region rejection
- Drift visualization
- Camera trajectory

Start with prerecorded sequences and a static scene. Do not promise SLAM-quality reconstruction. A valuable outcome is an honest visualization of how pose error and inconsistent monocular scale destroy naive accumulation.

### D. WebXR mode

Render the point cloud in an immersive session or use it as the bridge to the later semantic-anchoring project. Preserve the camera/geometry modules so the core reconstruction can be reused.

### E. Model comparison laboratory

Support interchangeable model adapters and compare:

- Latency
- Memory
- Temporal stability
- Thin structures
- Edge quality
- Relative-depth ordering

This becomes much more meaningful than merely listing benchmark numbers because the same interactive scene exposes each model’s behavior.

---

## 14. Suggested work plan for one developer

### Week 1: Make geometry visible

- Scaffold the application.
- Build synthetic-depth tests.
- Integrate frozen-image inference.
- Render the first depth map.
- Back-project the first point cloud.

**End-of-week artifact:** An uploaded image becomes an orbitable colored point cloud.

### Week 2: Make it live and inspectable

- Add webcam capture.
- Implement latest-frame-wins scheduling.
- Add freeze/resume and camera controls.
- Add selected-pixel inspection.
- Add performance instrumentation.

**End-of-week artifact:** A stable live webcam-to-point-cloud demonstration.

### Week 3: Mesh and polish

- Generate topology.
- Reject discontinuities.
- Add normals and wireframe.
- Add PLY export.
- Build example/failure gallery.
- Deploy and record the demo.

**End-of-week artifact:** A public, technically explained portfolio project.

If inference integration or browser backends take longer than expected, ship the frozen-image point-cloud version first. It already demonstrates the central idea.

---

## 15. Definition of done

The v1 project is complete when:

- A user can open an image or grant webcam permission.
- The application produces a depth map locally.
- The same result becomes an RGB-aligned, orbitable point cloud.
- A frozen result can become a discontinuity-aware mesh.
- Users can inspect pixel depth and XYZ coordinates.
- Camera assumptions and relative scale are explicit.
- The live pipeline remains responsive and never accumulates an unbounded queue.
- At least one geometry format can be exported and opened externally.
- The README explains the camera model, system architecture, performance, and failures.
- A deployed demo and short video make the result accessible without reading the code.

Temporal fusion, metric reconstruction, WebXR, and multiple model adapters are not required for v1.

---

## 16. Portfolio narrative

Frame the project as an interactive perception system rather than “I ran a depth model in the browser.” A strong summary would be:

> Built a privacy-preserving browser spatial viewer that transforms monocular webcam frames into inspectable depth maps, colored point clouds, and discontinuity-aware meshes. Implemented camera back-projection, typed-array geometry generation, bounded-latency frame scheduling, interactive calibration controls, and geometry export using TypeScript, browser model inference, and Three.js.

In interviews, be prepared to explain:

- Why monocular depth generally lacks metric scale.
- How intrinsics affect point-cloud shape.
- Why a 2.5D reconstruction is not a complete mesh.
- How triangle rejection prevents foreground-background bridges.
- Why inference FPS and render FPS are different.
- How latest-frame-wins scheduling controls latency.
- Which parts run on the CPU, GPU, and browser main thread.
- What fails on reflective, transparent, textureless, and thin objects.

The most valuable final artifact is not just a beautiful point cloud. It is a viewer that makes the entire perception pipeline understandable.
