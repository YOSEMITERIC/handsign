import { V3, sub, cross, normalizeV, norm, mulRT } from "./math";

export type LM = V3[]; // 21 điểm

export function buildPalmFrame(lm: LM) {
  const wrist = lm[0];
  const i_mcp = lm[5];
  const p_mcp = lm[17];

  const xAxis = normalizeV(sub(i_mcp, wrist));
  const vP = sub(p_mcp, wrist);
  let zAxis = normalizeV(cross(xAxis, vP));
  if (norm(zAxis) < 1e-6) zAxis = { x: 0, y: 0, z: 1 };
  const yAxis = normalizeV(cross(zAxis, xAxis));

  const R = [
    [xAxis.x, yAxis.x, zAxis.x],
    [xAxis.y, yAxis.y, zAxis.y],
    [xAxis.z, yAxis.z, zAxis.z],
  ];
  return { R, wrist };
}

export function orientNormalizeWorld(lm: LM, handed: "Left" | "Right" | "Unknown" = "Unknown"): LM {
  const wrist = lm[0];
  const mid = lm[9];
  const scale = Math.hypot(mid.x - wrist.x, mid.y - wrist.y, mid.z - wrist.z) || 1;
  const { R, wrist: w } = buildPalmFrame(lm);

  return lm.map((p) => {
    const t = { x: (p.x - w.x) / scale, y: (p.y - w.y) / scale, z: (p.z - w.z) / scale };
    const r = mulRT(R, t);
    return handed === "Left" ? { x: -r.x, y: r.y, z: r.z } : r;
  });
}

export function toVec63(lm: LM) {
  const out: number[] = [];
  for (const p of lm) out.push(p.x, p.y, p.z);
  return out;
}
