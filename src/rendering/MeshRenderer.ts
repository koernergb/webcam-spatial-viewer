import * as THREE from "three";
import type { ReconstructionBuffers } from "../geometry/types";

export type SpatialRenderMode = "points" | "solid" | "wireframe" | "normals" | "rejected";

export class MeshRenderer {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.BufferGeometry();
  private readonly rejectedGeometry = new THREE.BufferGeometry();
  private readonly solid = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 });
  private readonly wireframe = new THREE.MeshBasicMaterial({ vertexColors: true, wireframe: true });
  private readonly normals = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
  private readonly rejected = new THREE.MeshBasicMaterial({ color: 0xff3b4f, wireframe: true, transparent: true, opacity: 0.8 });
  private readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material> = new THREE.Mesh(this.geometry, this.solid);
  private readonly rejectedMesh = new THREE.Mesh(this.rejectedGeometry, this.rejected);

  constructor() {
    this.group.add(this.mesh, this.rejectedMesh);
    this.group.visible = false;
    this.rejectedMesh.visible = false;
  }

  setFromBuffers(buffers: ReconstructionBuffers): void {
    const position = new THREE.BufferAttribute(buffers.positions, 3);
    const color = new THREE.BufferAttribute(buffers.colors, 3, true);
    this.geometry.setAttribute("position", position);
    this.geometry.setAttribute("color", color);
    this.geometry.setIndex(new THREE.BufferAttribute(buffers.indices ?? new Uint32Array(), 1));
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.rejectedGeometry.setAttribute("position", position);
    this.rejectedGeometry.setIndex(new THREE.BufferAttribute(buffers.rejectedIndices ?? new Uint32Array(), 1));
  }

  setMode(mode: SpatialRenderMode): void {
    this.group.visible = mode !== "points";
    this.rejectedMesh.visible = mode === "rejected";
    this.mesh.material = mode === "wireframe" ? this.wireframe : mode === "normals" ? this.normals : this.solid;
  }

  dispose(): void {
    this.geometry.dispose(); this.rejectedGeometry.dispose();
    this.solid.dispose(); this.wireframe.dispose(); this.normals.dispose(); this.rejected.dispose();
  }
}
