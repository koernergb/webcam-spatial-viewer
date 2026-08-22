# Parallax Lab — Implementation Milestones

This document is the working implementation guide. Follow it in order. Do not start a later milestone until the current one is accepted.

The product is a **single-frame 2.5D reconstruction viewer**, not a scanner. Keep that boundary visible in UI copy, labels, and README as soon as those surfaces exist.

Companion spec: `Webcam_Spatial_Viewer_Build_Brief.md`.

---

## How to use this document

### For the implementing agent

- Implement **one milestone at a time**. Finish its tasks and tests, then **stop**.
- Do not start workers, live webcam, mesh export, adaptive quality, or optional extensions until the current milestone asks for them.
- Keep large pixel/vertex buffers out of React state. Three.js owns GPU objects; the rest of the app supplies typed arrays.
- Prefer a working, inspectable pipeline over polish. Model quality is secondary to a stable pipeline in early milestones.
- When a **STOP** gate appears, do not continue. Summarize what was built, how to run it, and what the human should verify.

### For the human

Each **STOP** gate is a judgment, debugging, or validation checkpoint. Typical reasons:

- Visual orientation bugs (mirror, flip, transpose, inverted depth) are cheaper to catch by eye than by more code.
- Model/backend choice and camera assumptions need a person looking at real scenes.
- Live capture, permissions, and performance need a real machine and a real webcam.
- Portfolio framing (honesty about relative depth, failure modes) is a product decision.

If a STOP check fails, stay on that milestone. Do not paper over it with extra shaders, workers, or UI.

### Default stack decisions

Use these unless a later STOP explicitly revises them:

| Choice | Decision |
| --- | --- |
| UI | React + TypeScript + Vite |
| State | Zustand for user-facing settings only |
| 3D | Direct Three.js (not R3F) so camera/geometry fundamentals stay visible |
| Inference | ONNX Runtime Web; WebGPU first, WASM fallback |
| Workers | None until a milestone says so, and only after a measured stall |
| Scale | Label everything as **relative scene units** |

---

## Global stop rules

Stop and wait for a human, even mid-milestone, if any of the following is true:

1. **Orientation is ambiguous.** The cloud or depth map might be mirrored, flipped, transposed, or using the wrong camera axis. Do not add compensating hacks in multiple places.
2. **Depth polarity is ambiguous.** Near objects may be far, or the adapter may be treating inverse-depth as depth. Do not add arbitrary sign flips.
3. **Memory or GPU objects are leaking** during a short repeated-run test (reload, re-infer, freeze/resume).
4. **A required human asset is missing:** webcam, example images, a chosen ONNX model file, or an external viewer for export checks.
5. **A product copy decision is needed:** how strongly to warn that this is not metric 3D, not a scan, not mobile-ready.
6. **The next step would be an optional extension** (metric calibration, temporal fusion, pose accumulation, WebXR, multi-model lab). Those are out of v1.

---

## Milestone 0 — Geometry sandbox

**Goal:** Prove the pinhole camera and Three.js coordinate conversion with **no neural model**.

**Duration:** 1–2 days

### Implement

- Scaffold Vite + React + TypeScript.
- Repository layout from the brief (`src/geometry`, `src/rendering`, `src/diagnostics`, `src/tests`).
- `camera.ts`: FOV → focal length, principal point at image center, square pixels.
- `backproject.ts`: image \((u,v,z)\) → camera XYZ, then one documented conversion into Three.js (+x right, +y up).
- Synthetic depth sources: a fronto-parallel plane and a sphere-like depth field.
- Three.js viewport: points, orbit controls, XYZ axes, optional camera frustum.
- Unit tests for known pixels and expected XYZ.

### Do not implement yet

- ONNX, webcam, mesh, export, workers, inspector chrome beyond what is needed to see axes and FOV.

### Acceptance

- Center pixel reconstructs on the camera axis.
- Symmetric pixels reconstruct symmetrically.
- Changing FOV visibly widens/narrows the cloud as expected.
- Image origin, camera look axis, and Three.js conversion are written down in code comments or a short `src/geometry/README.md`.
- Unit tests pass without a model.

### STOP — human geometry check

**Why stop:** A wrong look-axis or Y-down/Y-up conversion will poison every later milestone. It is easier to see on a synthetic plane than on a noisy depth map.

**Human should:**

1. Open the sandbox and confirm axes: +x right, +y up, camera pose matching the documented convention.
2. Confirm the synthetic plane faces the camera and is not mirrored or upside-down.
3. Change FOV and confirm shape change without a mysterious scale jump.
4. Spot-check one unit test against an independent calculation (center pixel and one corner).

**Pass:** Geometry convention is accepted in writing (look axis, handedness, Y conversion).

**Fail:** Stay on M0. Do not “fix” orientation later inside the model adapter.

---

## Milestone 1 — Frozen-image depth laboratory

**Goal:** Load a local image, run a small on-device depth model, and inspect the 2D depth map.

**Duration:** 3–5 days

### Implement

- Image upload / example-image loader (`ImageSource.ts`).
- `DepthModelAdapter` + `OnnxDepthAdapter` isolation from the rest of the app.
- Model load progress and recoverable error states.
- Preprocess / postprocess / normalization (robust 2nd–98th percentile **and** fixed-range mode).
- Depth panel: colormap (grayscale, turbo, inferno-like), raw vs normalized, tensor size, inference timing.
- A small fixture set: indoor, person, object, and at least one reflective/difficult example.
- Local privacy copy: processing stays on-device; no upload.

### Do not implement yet

- Webcam, point cloud, mesh, workers (unless load/infer **cannot** run on the main thread at all — still prefer frozen-image correctness first).
- Per-frame independent normalization as the only live-looking default; it hides pumping later.

### Acceptance

- Model loads with understandable progress and failure messages.
- Repeated inference on the same image does not grow memory.
- Input/output orientation matches the RGB image (not transposed or mirrored).
- Ordinary scenes have visually sensible near/far ordering.
- Raw model values and normalized depth are both inspectable.
- Depth kind (`depth` | `inverse-depth` | `relative-depth`) is explicit on the adapter result.

### STOP — human depth-map check

**Why stop:** Choosing the model, backend (WebGPU vs WASM), output semantics, and whether near/far are inverted is a judgment call. Automated tests cannot certify “this indoor photo looks right.”

**Human should:**

1. Confirm the chosen model file and license are acceptable to ship in `public/models/`.
2. Run indoor, person, and object fixtures. Near objects must look nearer.
3. Toggle raw vs robust-normalized display and confirm the legend says **relative**.
4. Watch a few repeated inferences in browser memory tools for growth.
5. Confirm WebGPU vs WASM fallback messaging is honest on this machine.

**Pass:** Depth polarity, orientation, and model choice are accepted.

**Fail:** Do not start back-projection. Fix adapter/preprocess first. If near/far is wrong, inspect model semantics — do not invert in the renderer.

---

## Milestone 2 — Colored point cloud

**Goal:** Turn one frozen depth result into an orbitable, RGB-colored point cloud with inspectable pixels. This is the first portfolio-worthy slice.

**Duration:** 3–5 days

### Implement

- Back-project adapter depth with the M0 camera model.
- Attach source RGB at the same sample locations.
- Sampling stride presets: Fast (every 4th), Balanced (every 2nd), Full (every pixel, frozen).
- Reuse `BufferGeometry`; update attributes in place.
- Orbit, pan, zoom, reset-to-source-camera.
- Controls that must **not** re-run inference: FOV, depth scale, near/far clip, point size, stride.
- Pixel picking from RGB or depth → \((u,v)\), RGB, raw value, converted depth, XYZ, validity.
- Axes, grid, optional frustum. Inspector fields from the brief that apply to points.

### Do not implement yet

- Webcam, mesh, PLY/glTF, adaptive quality, custom splat shaders, workers unless geometry build **blocks** the UI on Full stride.

### Acceptance

- Frozen image → correctly oriented colored cloud.
- RGB stays aligned at all supported strides.
- Parameter changes that do not need a new depth map skip inference.
- Center-pixel test from M0 still holds on model depth.
- Units are labeled relative scene units.
- Presets exist: Fast, Balanced, Inspect — each with a reset.

### STOP — human point-cloud check *(ship gate)*

**Why stop:** This is the first public-quality artifact. Publish-or-not, orientation, and “does this look like the photo” are human calls. The brief says to publish this before live inference.

**Human should:**

1. Orbit a person/object scene: silhouette should read as 2.5D, not a random blob.
2. Confirm RGB alignment (no color sliding off edges).
3. Pick the center pixel and a known foreground pixel; XYZ should match intuition given relative scale.
4. Change FOV: shape should change; topology of the *points* should not “tear” from a coordinate bug.
5. Decide: is this slice good enough to demo while M3+ continue?

**Pass:** Frozen-image point cloud is accepted. Optionally pause here for a short writeup/demo if inference or webcam work is expected to slip.

**Fail:** Do not add live capture on a wrong cloud. Stay on M2.

---

## Milestone 3 — Live webcam pipeline

**Goal:** Bounded-latency live depth on a webcam, with freeze/resume and honest performance numbers.

**Duration:** 3–6 days

### Implement

- Secure-context webcam permission flow; camera selector; start/stop.
- `requestVideoFrameCallback` when available.
- **Latest-frame-wins** scheduling: never queue unbounded frames.
- RGB preview can run at camera rate; depth/cloud updates at inference rate.
- Freeze/resume: freeze restores higher point density; live may use a lower stride.
- Mirror preview is **display-only**. Depth and geometry always use a single unmirrored pixel space.
- Performance strip: inference FPS, render FPS, result age, resolution, queue/pending state. Never report render FPS alone.
- Dispose media tracks, bitmaps, and model resources on stop/unmount.

### Do not implement yet

- Mesh, export, temporal smoothing as a hidden default, adaptive resolution (that is a follow-on after this STOP), workers unless profiling shows a specific main-thread stall.

### Acceptance

- UI stays responsive during sustained inference.
- Pending work is at most one next frame; the queue cannot grow without bound.
- Freeze yields a stable high-density cloud.
- Stop/unmount releases tracks and model resources.
- Frames never leave the device.
- Result age is visible when inference is slow.

### STOP — human live-pipeline check

**Why stop:** Permissions, camera quirks, selfie-mirror mismatch, thermal/CPU behavior, and “is 3 FPS depth acceptable if the UI says so” need a real browser session. Also run the five-minute soak on the target Apple Silicon Mac.

**Human should:**

1. Grant/deny camera; confirm errors are understandable.
2. Toggle mirror preview and confirm the cloud does **not** independently flip.
3. Freeze/resume several times; confirm no duplicate tracks or leaked bitmaps.
4. Watch inference FPS vs render FPS vs result age for at least several minutes.
5. Soak ~5 minutes: memory should not trend up; UI should remain interactive.
6. Confirm nothing is uploaded (dev tools network).

**Pass:** Live demo is trustworthy on the development machine.

**Fail:** Do not start mesh work on an unbounded or leaky pipeline. If stalled, profile before adding workers.

---

## Milestone 3b — Adaptive quality *(optional, after M3 pass)*

**Goal:** Conservative adaptation only after the live baseline is correct.

### Implement only if M3 passed and result age is routinely too high

- Lower model input resolution when result age stays above a threshold.
- Reduce live point density; restore Full (or Inspect) on Freeze.
- Change **one** knob at a time and display what changed.

### STOP — human adaptation check

**Why stop:** Adaptation can hide model behavior and look like a bug. A person must decide whether the extra complexity is worth it for v1.

**Human should:** Confirm the UI explains the active preset/adaptation, and that Freeze still produces the inspectable high-density result.

If the human says skip: go to M4. Do not invent more automatic tuning.

---

## Milestone 4 — Depth-aware mesh

**Goal:** Build a discontinuity-aware triangle mesh from the same frozen (or frozen-from-live) depth field.

**Duration:** 4–7 days

### Implement

- Grid topology: four neighbors → two candidate triangles.
- Reject: invalid vertex, relative depth jump \(\frac{z_{max}-z_{min}}{\max(z_{min},\epsilon)} < \tau\), max 3D edge length, optional implausible normals.
- Solid / wireframe / normal-debug modes.
- Vertex normals **after** topology is correct. Smoothing off by default.
- Report valid triangle count, rejected count, and rejection percentage.
- Debug coloring for rejected triangles (flying-triangle diagnosis).
- Move geometry construction to a worker **only if** profiling on Inspect/Full density shows a real stall.

### Do not implement yet

- glTF export (M5), temporal fusion, filling occluded surfaces, mesh smoothing as a silent default.

### Acceptance

- Foreground silhouettes do not routinely sheet into the background at a reasonable \(\tau\).
- Winding and normals are not widely inverted (normal debug looks coherent).
- Threshold and max-edge controls change topology predictably without re-inference.
- Rejected-triangle stats are visible.

### STOP — human mesh check

**Why stop:** “Enough” discontinuity rejection is aesthetic and scene-dependent. Normal/winding errors look like lighting bugs. Flying triangles are easier to confirm visually than to unit-test away entirely.

**Human should:**

1. Use a person-in-front-of-room fixture. Silhouette should not be welded to the wall.
2. Enable normal debug and wireframe; look for widespread back-faces.
3. Sweep \(\tau\) and max edge length; confirm the stats move in the expected direction.
4. Decide default \(\tau\) / max-edge for Fast, Balanced, and Inspect.
5. Only then approve a geometry worker, if the profile says it is needed.

**Pass:** Mesh is an inspectable reconstruction of the visible surface, with honest holes.

**Fail:** Stay on M4. Do not export a broken mesh. Do not “fix” normals by flipping in the shader only.

---

## Milestone 5 — Export, gallery, and presentation

**Goal:** External-viewer export, honest documentation, and a demo a visitor can understand quickly.

**Duration:** 3–5 days

### Implement

- ASCII PLY first (debuggable), then binary PLY if needed.
- Mesh glTF/GLB with color treatment documented.
- Coordinate and relative-scale metadata where the format allows.
- Screenshot of the 3D view.
- Example gallery with **failure-mode annotations** (reflective, transparent, textureless, thin structures).
- README: camera model, architecture, relative scale, performance, failures, non-goals.
- Architecture/geometry explanation suitable for a two-minute technical read.
- Deployed demo + short recorded video (human records the video unless they ask the agent to script capture).

### Do not implement yet

- Optional extensions in brief §13.
- Marketing language that implies metric accuracy, room scanning, or complete 3D.

### Acceptance

- PLY opens in an external viewer with correct color and orientation.
- Mesh export opens with expected geometry and color/texture treatment.
- README states clearly: monocular depth is relative; single-view geometry is incomplete; this is not SLAM.
- A visitor can grasp the project in ~30 seconds and inspect details within ~2 minutes.
- v1 definition of done from the brief is satisfied.

### STOP — human presentation check *(v1 ship gate)*

**Why stop:** Portfolio framing, which failures to highlight, whether to deploy, and whether the video is honest are not code decisions. External viewers (MeshLab, Blender, etc.) must be checked by a person.

**Human should:**

1. Open PLY and glTF in at least one external tool; confirm orientation vs the in-app view.
2. Read the README as a stranger: is relative scale and 2.5D limitation impossible to miss?
3. Walk the gallery; confirm failure annotations match what the model actually does.
4. Time a cold first-run: privacy notice, model load, first result.
5. Approve deploy URL and demo video contents.
6. Explicitly defer or reject optional extensions A–E.

**Pass:** v1 is done.

**Fail:** Fix export/docs/honesty issues before adding features.

---

## After v1 (do not implement unless explicitly requested)

These are research branches, not leftover chores:

| ID | Extension | First human decision required |
| --- | --- | --- |
| A | Metric-scale calibration | Is a two-point known-width tool worth the extra UI, given residual monocular distortion? |
| B | Temporal stabilization | Is hiding flicker acceptable, or must raw vs smoothed stay side by side? |
| C | Pose + accumulation | Treat as a separate experiment. Start from prerecorded static sequences. Do not imply SLAM. |
| D | WebXR | Only after geometry modules are stable and reusable. |
| E | Model comparison lab | Only after the adapter boundary has survived at least two models. |

---

## Suggested calendar vs gates

One-developer pacing from the brief, with STOP gates inserted:

| Week | Build | Must stop for human before calling the week done |
| --- | --- | --- |
| 1 | M0 sandbox + M1 depth lab + start M2 | M0 orientation; M1 depth polarity/model; M2 cloud if it lands |
| 2 | Finish M2 if needed; M3 live pipeline | M2 ship-or-continue; M3 soak, mirror, leaks |
| 3 | M4 mesh + M5 export/docs/demo | M4 flying triangles/normals; M5 external viewer + README honesty |

If M1 backend work overruns: **ship M2 frozen-image cloud** and delay live capture. Do not skip M0–M2 stop gates.

---

## Test checklist by milestone

Run the relevant slice before each STOP. Do not wait until M5 to add tests from the brief.

| Milestone | Minimum tests |
| --- | --- |
| M0 | FOV → focal length; center and corner back-projection; Three.js conversion |
| M1 | Depth/inverse-depth conversion; percentile normalization; invalid-depth filtering |
| M2 | RGB/stride alignment on a fixture; picking maps to the same \((u,v)\) as the depth panel |
| M3 | Scheduler never queues more than one pending frame (unit or harness); dispose releases tracks |
| M4 | Triangle winding; discontinuity rejection; golden counts on recorded depth (not live GPU output) |
| M5 | PLY header counts and vertex serialization |

Golden-image tests should hash **geometry summaries** (dimensions, valid counts, bounds, selected samples), not exact GPU-backend model floats.

---

## Agent handoff template

At every STOP, post a short status using this shape and then wait:

```text
Milestone: <n>
What landed: <files / how to run>
What the human should look at: <bullets from that STOP>
Known issues: <orientation, polarity, leaks, missing assets>
Not started (intentionally): <next milestone>
Need from human: <accept / reject / decision>
```
