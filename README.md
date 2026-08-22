# Parallax Lab

Browser spatial viewer: webcam or image → on-device depth → inspectable point cloud and mesh.

The project is at **Milestone 0 — Geometry sandbox**. There is no depth model and no webcam yet. The app back-projects synthetic depth so we can lock camera and Three.js conventions before inference.

Coordinate conventions: [`src/geometry/README.md`](src/geometry/README.md).

## Run

```bash
npm install
npm test
npm run dev
```

Open the printed local URL. Drag to orbit, scroll to zoom.

## Milestone 0 checks

1. Axes: +X right (red), +Y up (green), camera looks toward −Z (cyan arrow). The cloud sits on negative Z.
2. Fronto-parallel plane is not mirrored or upside-down. UV coloring: top-left dark, red to the right, green downward.
3. Increase horizontal FOV from the inspect view: the cloud widens in world units and still fits the source frustum.
4. **Reset to source camera**: the plane should fill the frustum. **Inspect view** pulls the camera back so FOV changes are obvious.

If those fail, stay on M0. Do not compensate in a later model adapter.

Implementation plan: [`milestones.md`](milestones.md). Product brief: [`Webcam_Spatial_Viewer_Build_Brief.md`](Webcam_Spatial_Viewer_Build_Brief.md).
