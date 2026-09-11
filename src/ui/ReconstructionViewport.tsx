import { useEffect, useRef, type MutableRefObject } from "react";
import type { CameraIntrinsics, ReconstructionBuffers } from "../geometry/types";
import { SpatialViewport } from "../rendering/SpatialViewport";
import type { SpatialRenderMode } from "../rendering/MeshRenderer";

export function ReconstructionViewport({ buffers, meshBuffers, intrinsics, pointSize, mode, viewportRef }: {
  buffers: ReconstructionBuffers;
  meshBuffers: ReconstructionBuffers;
  intrinsics: CameraIntrinsics;
  pointSize: number;
  mode: SpatialRenderMode;
  viewportRef: MutableRefObject<SpatialViewport | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const framed = useRef(false);
  useEffect(() => {
    if (!containerRef.current) return;
    const viewport = new SpatialViewport(containerRef.current);
    viewportRef.current = viewport;
    viewport.setShowAxes(true);
    viewport.setShowGrid(true);
    viewport.setShowFrustum(true);
    return () => { viewport.dispose(); viewportRef.current = null; };
  }, [viewportRef]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.setPointCloud(buffers);
    viewport.setMesh(meshBuffers);
    viewport.setSourceIntrinsics(intrinsics);
    viewport.setPointSize(pointSize);
    if (!framed.current) {
      viewport.resetToSourceCamera();
      framed.current = true;
    }
    viewport.setRenderMode(mode);
  }, [buffers, meshBuffers, intrinsics, mode, pointSize, viewportRef]);
  return <div className="viewport reconstruction-viewport" ref={containerRef} />;
}
