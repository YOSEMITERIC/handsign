export type V3 = { x: number; y: number; z: number };

export const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const norm = (a: V3) => Math.hypot(a.x, a.y, a.z);
export const normalizeV = (a: V3) => {
  const n = norm(a) || 1;
  return { x: a.x / n, y: a.y / n, z: a.z / n };
};

// mul (R^T) * v, với R = [x' y' z'] (cột)
export function mulRT(R: number[][], v: V3): V3 {
  return {
    x: R[0][0] * v.x + R[1][0] * v.y + R[2][0] * v.z,
    y: R[0][1] * v.x + R[1][1] * v.y + R[2][1] * v.z,
    z: R[0][2] * v.x + R[1][2] * v.y + R[2][2] * v.z,
  };
}
