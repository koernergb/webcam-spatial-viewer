import type { ReconstructionBuffers } from "../geometry/types";

function vertexLine(buffers: ReconstructionBuffers, index: number): string {
  const offset = index * 3;
  return `${buffers.positions[offset]} ${buffers.positions[offset + 1]} ${buffers.positions[offset + 2]} ${buffers.colors[offset]} ${buffers.colors[offset + 1]} ${buffers.colors[offset + 2]}`;
}

export function serializePointCloudPly(buffers: ReconstructionBuffers): string {
  const count = buffers.validVertexCount;
  const header = `ply\nformat ascii 1.0\ncomment Parallax Lab relative scene units\nelement vertex ${count}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face 0\nproperty list uchar int vertex_indices\nend_header\n`;
  const lines = new Array<string>(count);
  for (let index = 0; index < count; index++) lines[index] = vertexLine(buffers, index);
  return header + lines.join("\n") + "\n";
}

export function serializeMeshPly(buffers: ReconstructionBuffers): string {
  const indices = buffers.indices ?? new Uint32Array();
  const used = Array.from(new Set(indices)).sort((a, b) => a - b);
  const remap = new Map(used.map((source, target) => [source, target]));
  const faceCount = indices.length / 3;
  const header = `ply\nformat ascii 1.0\ncomment Parallax Lab relative scene units; single-view 2.5D\nelement vertex ${used.length}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face ${faceCount}\nproperty list uchar int vertex_indices\nend_header\n`;
  const vertices = used.map((index) => vertexLine(buffers, index));
  const faces = new Array<string>(faceCount);
  for (let face = 0; face < faceCount; face++) faces[face] = `3 ${remap.get(indices[face * 3])} ${remap.get(indices[face * 3 + 1])} ${remap.get(indices[face * 3 + 2])}`;
  return header + vertices.join("\n") + "\n" + faces.join("\n") + "\n";
}
