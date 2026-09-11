export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraIntrinsics {
  width: number;
  height: number;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  fovXRadians: number;
}

export interface ReconstructionBuffers {
  positions: Float32Array;
  colors: Uint8Array;
  indices?: Uint32Array;
  validVertexCount: number;
  validTriangleCount?: number;
  candidateTriangleCount?: number;
  rejectedTriangleCount?: number;
  rejectedIndices?: Uint32Array;
}
