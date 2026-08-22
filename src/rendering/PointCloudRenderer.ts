import * as THREE from "three";
import type { ReconstructionBuffers } from "../geometry/types";

export class PointCloudRenderer {
  readonly points: THREE.Points;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.PointsMaterial;
  private capacity = 0;

  constructor() {
    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.PointsMaterial({
      size: 2,
      sizeAttenuation: false,
      vertexColors: true,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  setFromBuffers(buffers: ReconstructionBuffers): void {
    const n = buffers.validVertexCount;
    this.ensureCapacity(Math.max(n, 1));

    const pos = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    const col = this.geometry.getAttribute("color") as THREE.BufferAttribute;
    (pos.array as Float32Array).set(buffers.positions.subarray(0, n * 3));
    (col.array as Uint8Array).set(buffers.colors.subarray(0, n * 3));
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.geometry.setDrawRange(0, n);
    this.geometry.computeBoundingSphere();
  }

  setPointSize(size: number): void {
    this.material.size = size;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  private ensureCapacity(n: number): void {
    if (this.capacity >= n) return;
    this.capacity = n;
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(n * 3), 3),
    );
    this.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Uint8Array(n * 3), 3, true),
    );
  }
}
