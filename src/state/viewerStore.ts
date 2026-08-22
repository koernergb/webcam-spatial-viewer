import { create } from "zustand";
import { DEFAULT_FOV_X_DEGREES, DEFAULT_POINT_SIZE } from "./settings";

export type SyntheticScene = "plane" | "sphere";

export interface ViewerState {
  fovXDegrees: number;
  syntheticScene: SyntheticScene;
  showAxes: boolean;
  showFrustum: boolean;
  showGrid: boolean;
  pointSize: number;
  setFovXDegrees: (value: number) => void;
  setSyntheticScene: (scene: SyntheticScene) => void;
  setShowAxes: (value: boolean) => void;
  setShowFrustum: (value: boolean) => void;
  setShowGrid: (value: boolean) => void;
  setPointSize: (value: number) => void;
  resetSettings: () => void;
}

const defaults = {
  fovXDegrees: DEFAULT_FOV_X_DEGREES,
  syntheticScene: "plane" as SyntheticScene,
  showAxes: true,
  showFrustum: true,
  showGrid: true,
  pointSize: DEFAULT_POINT_SIZE,
};

export const useViewerStore = create<ViewerState>((set) => ({
  ...defaults,
  setFovXDegrees: (fovXDegrees) => set({ fovXDegrees }),
  setSyntheticScene: (syntheticScene) => set({ syntheticScene }),
  setShowAxes: (showAxes) => set({ showAxes }),
  setShowFrustum: (showFrustum) => set({ showFrustum }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setPointSize: (pointSize) => set({ pointSize }),
  resetSettings: () => set(defaults),
}));
