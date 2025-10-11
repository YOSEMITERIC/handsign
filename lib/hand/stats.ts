export function meanVec(vecs: number[][]) {
  const n = vecs.length, d = vecs[0].length;
  const mu = Array(d).fill(0);
  for (const v of vecs) for (let i = 0; i < d; i++) mu[i] += v[i];
  for (let i = 0; i < d; i++) mu[i] /= n;
  return mu;
}

export function rmsdVec(x: number[], mu: number[]) {
  let s = 0;
  for (let i = 0; i < x.length; i++) {
    const e = x[i] - mu[i];
    s += e * e;
  }
  return Math.sqrt(s / x.length);
}
