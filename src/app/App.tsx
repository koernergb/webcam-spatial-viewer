import { useMemo, useRef, useState } from "react";
import { SpatialViewport } from "../rendering/SpatialViewport";
import { useViewerStore } from "../state/viewerStore";
import { SandboxPanel } from "../ui/SandboxPanel";
import { ViewportHost } from "../ui/ViewportHost";
import { DepthLab } from "../ui/DepthLab";
import { buildSandboxCloud } from "./buildSandboxCloud";

export default function App() {
  const [screen, setScreen] = useState<"depth" | "sandbox">("depth");
  const viewportRef = useRef<SpatialViewport | null>(null);
  const fovXDegrees = useViewerStore((s) => s.fovXDegrees);
  const syntheticScene = useViewerStore((s) => s.syntheticScene);

  const reconstruction = useMemo(
    () => buildSandboxCloud(syntheticScene, fovXDegrees),
    [fovXDegrees, syntheticScene],
  );

  if (screen === "depth") return <DepthLab onSandbox={() => setScreen("sandbox")} />;

  return (
    <div className="app">
      <ViewportHost viewportRef={viewportRef} />
      <SandboxPanel
        intrinsics={reconstruction.intrinsics}
        pointCount={reconstruction.buffers.validVertexCount}
        onInspectView={() => viewportRef.current?.resetToInspectView()}
        onSourceCamera={() => viewportRef.current?.resetToSourceCamera()}
        onDepthLab={() => setScreen("depth")}
      />
    </div>
  );
}
