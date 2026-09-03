# Parallax Lab

Browser spatial viewer: webcam or image → on-device depth → inspectable point cloud and mesh.

The project is at **Milestone 3 — Live webcam pipeline**. Use a local image,
fixture, or webcam to run Depth Anything V2 Small locally, inspect the depth
result, and orbit an RGB-aligned 2.5D point cloud. Live inference uses a
latest-frame-wins scheduler so work cannot queue without bound. Freeze switches
to full point density for inspection.

There is no mesh yet. Depth and reconstructed coordinates are relative, not
metric measurements.

Coordinate conventions: [`src/geometry/README.md`](src/geometry/README.md).

## Run

```bash
npm install
npm test
npm run dev
```

Open the printed local URL. Drag to orbit, scroll to zoom.

## Milestone 1 checks

1. Use the bundled Person, Indoor layers, Glass + reflections, and Thin details fixtures.
2. Confirm the RGB and depth output have matching orientation.
3. Confirm near/far ordering is visually sensible and record the output polarity.
4. Compare robust 2–98% normalization with fixed raw min/max.
5. Repeat inference while watching browser memory for growth.

The validation fixtures are AI-generated specifically for testing depth ordering,
orientation, reflective/transparent failure behavior, and preservation of thin
structures. They are not model training data or quality benchmarks.

## Milestone 0 checks

1. Axes: +X right (red), +Y up (green), camera looks toward −Z (cyan arrow). The cloud sits on negative Z.
2. Fronto-parallel plane is not mirrored or upside-down. UV coloring: top-left dark, red to the right, green downward.
3. Increase horizontal FOV from the inspect view: the cloud widens in world units and still fits the source frustum.
4. **Reset to source camera**: the plane should fill the frustum. **Inspect view** pulls the camera back so FOV changes are obvious.

If those fail, stay on M0. Do not compensate in a later model adapter.

Implementation plan: [`milestones.md`](milestones.md). Product brief: [`Webcam_Spatial_Viewer_Build_Brief.md`](Webcam_Spatial_Viewer_Build_Brief.md).
