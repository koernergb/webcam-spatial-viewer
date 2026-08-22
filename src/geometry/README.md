# Geometry conventions

This is the single coordinate-system boundary for Parallax Lab. Later milestones must not add extra sign flips in the model adapter or renderer.

Units are **relative scene units**. They are not meters.

## Image

- Origin: top-left
- `+u` / image `+x`: right
- `+v` / image `+y`: down
- Pixel samples use integer indices `u ∈ [0, W)`, `v ∈ [0, H)`
- Principal point at the pixel-grid center: `cx = (W − 1) / 2`, `cy = (H − 1) / 2`

## Camera (pinhole math)

OpenCV-style, used by `backprojectToCamera`:

- Origin: camera center
- `+X`: right
- `+Y`: down (same sense as image `+v`)
- `+Z`: forward — **the camera looks along +Z**
- Depth `z` is the camera-space Z coordinate, not Euclidean ray length

```
x = (u − cx) * z / fx
y = (v − cy) * z / fy
Z = z
```

Square pixels: `fx = fy`. Horizontal FOV to focal length:

```
fx = W / (2 * tan(FOVx / 2))
```

`W` in that formula is the image width in pixels, matching the build brief. Combined with `cx = (W − 1) / 2`, the outermost pixel is not exactly at ±FOVx/2. The difference is a fraction of a pixel and is ignored for M0.

## Three.js world

Applied **once** in `cameraToThree`:

```
x_three =  x_cam
y_three = −y_cam
z_three = −z_cam
```

So:

- Three.js `+X`: right
- Three.js `+Y`: up (image top lands on +Y)
- Three.js `+Z`: toward the viewer when looking along the look axis
- The source camera sits at the origin and looks toward **−Z**
- Reconstructed points in front of the camera have **negative Z**

## Sanity checks

From the source camera (origin, looking −Z, Y up):

- Image top-left is dark with the M0 UV coloring (R increases with `u`, G with `v`)
- Image right is +X (red axis)
- Image top is +Y (green axis)
- The cloud sits on the **negative Z** side of the origin; the blue axis points toward the viewer, opposite the cloud
- Increasing horizontal FOV widens the cloud in world units at fixed depth; the source frustum should still enclose it
