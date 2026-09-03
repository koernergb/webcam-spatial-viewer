export type Colormap = "grayscale" | "turbo" | "inferno";

function stops(value: number, colors: readonly (readonly [number, number, number])[]): [number, number, number] {
  const scaled = Math.max(0, Math.min(1, value)) * (colors.length - 1);
  const left = Math.floor(scaled);
  const right = Math.min(left + 1, colors.length - 1);
  const mix = scaled - left;
  return colors[left].map((channel, index) =>
    Math.round(channel + (colors[right][index] - channel) * mix),
  ) as [number, number, number];
}

export function colorizeDepth(values: Float32Array, map: Colormap): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(values.length * 4);
  const palette = map === "turbo"
    ? [[48, 18, 59], [35, 137, 191], [65, 226, 110], [245, 207, 45], [180, 4, 38]] as const
    : [[0, 0, 4], [87, 15, 109], [187, 55, 84], [249, 142, 8], [252, 255, 164]] as const;
  for (let index = 0; index < values.length; index++) {
    const gray = Math.round(values[index] * 255);
    const [red, green, blue] = map === "grayscale" ? [gray, gray, gray] : stops(values[index], palette);
    pixels.set([red, green, blue, 255], index * 4);
  }
  return pixels;
}
