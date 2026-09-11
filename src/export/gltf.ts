import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import type { ReconstructionBuffers } from "../geometry/types";

export async function serializeMeshGlb(buffers: ReconstructionBuffers): Promise<ArrayBuffer> {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(buffers.positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(buffers.colors, 3, true));
  geometry.setIndex(new THREE.BufferAttribute(buffers.indices ?? new Uint32Array(), 1));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Parallax Lab relative-depth mesh";
  mesh.userData = { units: "relative scene units", reconstruction: "single-view 2.5D", metric: false };
  try {
    const output = await new GLTFExporter().parseAsync(mesh, { binary: true, onlyVisible: true });
    if (!(output instanceof ArrayBuffer)) throw new Error("GLB exporter returned JSON instead of binary data.");
    return output;
  } finally { geometry.dispose(); material.dispose(); }
}
