import {
  FOV_X_MAX_DEGREES,
  FOV_X_MIN_DEGREES,
  SANDBOX_HEIGHT,
  SANDBOX_WIDTH,
} from "../state/settings";
import { useViewerStore } from "../state/viewerStore";
import { radiansToDegrees, verticalFovRadians } from "../geometry/camera";
import type { CameraIntrinsics } from "../geometry/types";

export function SandboxPanel({
  intrinsics,
  pointCount,
  onInspectView,
  onSourceCamera,
  onDepthLab,
}: {
  intrinsics: CameraIntrinsics;
  pointCount: number;
  onInspectView: () => void;
  onSourceCamera: () => void;
  onDepthLab: () => void;
}) {
  const fovXDegrees = useViewerStore((s) => s.fovXDegrees);
  const syntheticScene = useViewerStore((s) => s.syntheticScene);
  const showAxes = useViewerStore((s) => s.showAxes);
  const showFrustum = useViewerStore((s) => s.showFrustum);
  const showGrid = useViewerStore((s) => s.showGrid);
  const pointSize = useViewerStore((s) => s.pointSize);
  const setFovXDegrees = useViewerStore((s) => s.setFovXDegrees);
  const setSyntheticScene = useViewerStore((s) => s.setSyntheticScene);
  const setShowAxes = useViewerStore((s) => s.setShowAxes);
  const setShowFrustum = useViewerStore((s) => s.setShowFrustum);
  const setShowGrid = useViewerStore((s) => s.setShowGrid);
  const setPointSize = useViewerStore((s) => s.setPointSize);
  const resetSettings = useViewerStore((s) => s.resetSettings);

  const fovY = radiansToDegrees(verticalFovRadians(intrinsics));

  return (
    <aside className="panel">
      <header>
        <p className="eyebrow">Milestone 0</p>
        <h1>Parallax Lab</h1>
        <p className="lede">
          Geometry sandbox. Synthetic depth only — no neural model. Units are
          relative scene units.
        </p>
      </header>
      <button type="button" className="ghost" onClick={onDepthLab}>Frozen-image depth lab</button>

      <section>
        <h2>Scene</h2>
        <label className="row">
          <span>Depth field</span>
          <select
            value={syntheticScene}
            onChange={(event) =>
              setSyntheticScene(event.target.value as "plane" | "sphere")
            }
          >
            <option value="plane">Fronto-parallel plane</option>
            <option value="sphere">Sphere in front of a plane</option>
          </select>
        </label>
      </section>

      <section>
        <h2>Camera</h2>
        <label className="row">
          <span>Horizontal FOV</span>
          <strong>{fovXDegrees.toFixed(0)}°</strong>
        </label>
        <input
          type="range"
          min={FOV_X_MIN_DEGREES}
          max={FOV_X_MAX_DEGREES}
          step={1}
          value={fovXDegrees}
          onChange={(event) => setFovXDegrees(Number(event.target.value))}
        />
        <p className="hint">
          Wider FOV should widen the cloud in world units. The source frustum
          should still enclose it.
        </p>
        <div className="actions">
          <button type="button" onClick={onInspectView}>
            Inspect view
          </button>
          <button type="button" onClick={onSourceCamera}>
            Reset to source camera
          </button>
        </div>
      </section>

      <section>
        <h2>Display</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={showAxes}
            onChange={(event) => setShowAxes(event.target.checked)}
          />
          Axes + look arrow (−Z)
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={showFrustum}
            onChange={(event) => setShowFrustum(event.target.checked)}
          />
          Source camera frustum
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(event) => setShowGrid(event.target.checked)}
          />
          Ground grid (XZ)
        </label>
        <label className="row">
          <span>Point size</span>
          <strong>{pointSize.toFixed(0)} px</strong>
        </label>
        <input
          type="range"
          min={1}
          max={6}
          step={1}
          value={pointSize}
          onChange={(event) => setPointSize(Number(event.target.value))}
        />
        <button type="button" className="ghost" onClick={resetSettings}>
          Reset controls
        </button>
      </section>

      <section>
        <h2>Intrinsics</h2>
        <dl className="stats">
          <div>
            <dt>Image</dt>
            <dd>
              {SANDBOX_WIDTH} × {SANDBOX_HEIGHT}
            </dd>
          </div>
          <div>
            <dt>fx, fy</dt>
            <dd>
              {intrinsics.fx.toFixed(2)}, {intrinsics.fy.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt>cx, cy</dt>
            <dd>
              {intrinsics.cx.toFixed(1)}, {intrinsics.cy.toFixed(1)}
            </dd>
          </div>
          <div>
            <dt>FOV x / y</dt>
            <dd>
              {fovXDegrees.toFixed(1)}° / {fovY.toFixed(1)}°
            </dd>
          </div>
          <div>
            <dt>Points</dt>
            <dd>{pointCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Look axis</dt>
            <dd>camera +Z → world −Z</dd>
          </div>
        </dl>
      </section>

      <section className="legend">
        <h2>Orientation check</h2>
        <p>
          Point color is image UV: <span className="swatch red">R = right</span>
          , <span className="swatch green">G = down</span>. Top-left should be
          dark. From the source camera, green belongs at the <em>bottom</em> of
          the view. The cloud sits on negative Z; the blue axis points toward
          you, opposite the cloud.
        </p>
      </section>
    </aside>
  );
}
