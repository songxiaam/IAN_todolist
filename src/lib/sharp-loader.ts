type SharpModule = typeof import('sharp').default;

let sharpPromise: Promise<SharpModule> | null = null;

export function getSharp(): Promise<SharpModule> {
  if (!sharpPromise) {
    sharpPromise = import('sharp').then((mod) => mod.default);
  }
  return sharpPromise;
}
