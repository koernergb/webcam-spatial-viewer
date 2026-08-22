import { useEffect, useRef, type MutableRefObject } from "react";
import { SpatialViewport } from "../rendering/SpatialViewport";
import { useViewerStore } from "../state/viewerStore";
import { buildSandboxCloud } from "../app/buildSandboxCloud";

export function ViewportHost({
  viewportRef,
}: {
  viewportRef: MutableRefObject<SpatialViewport | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fovXDegrees = useViewerStore((s) => s.fovXDegrees);
  const syntheticScene = useViewerStore((s) => s.syntheticScene);
  const showAxes = useViewerStore((s) => s.showAxes);
  const showFrustum = useViewerStore((s) => s.showFrustum);
  const showGrid = useViewerStore((s) => s.showGrid);
  const pointSize = useViewerStore((s) => s.pointSize);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const viewport = new SpatialViewport(container);
    viewportRef.current = viewport;

    const state = useViewerStore.getState();
    const { intrinsics, buffers } = buildSandboxCloud(
      state.syntheticScene,
      state.fovXDegrees,
    );
    viewport.setPointCloud(buffers);
    viewport.setSourceIntrinsics(intrinsics);
    viewport.setShowAxes(state.showAxes);
    viewport.setShowFrustum(state.showFrustum);
    viewport.setShowGrid(state.showGrid);
    viewport.setPointSize(state.pointSize);

    return () => {
      viewport.dispose();
      viewportRef.current = null;
    };
  }, [viewportRef]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { intrinsics, buffers } = buildSandboxCloud(
      syntheticScene,
      fovXDegrees,
    );
    viewport.setPointCloud(buffers);
    viewport.setSourceIntrinsics(intrinsics);
  }, [fovXDegrees, syntheticScene, viewportRef]);

  useEffect(() => {
    viewportRef.current?.setShowAxes(showAxes);
  }, [showAxes, viewportRef]);

  useEffect(() => {
    viewportRef.current?.setShowFrustum(showFrustum);
  }, [showFrustum, viewportRef]);

  useEffect(() => {
    viewportRef.current?.setShowGrid(showGrid);
  }, [showGrid, viewportRef]);

  useEffect(() => {
    viewportRef.current?.setPointSize(pointSize);
  }, [pointSize, viewportRef]);

  return <div className="viewport" ref={containerRef} />;
}
