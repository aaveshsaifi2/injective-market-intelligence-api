/** Arithmetic mean. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Sample standard deviation. */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const sq = values.map((v) => (v - avg) ** 2);
  return Math.sqrt(sq.reduce((s, v) => s + v, 0) / (values.length - 1));
}

/** Log returns from a price series (oldest-first). */
export function logReturns(prices: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      r.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  return r;
}

/** Annualized volatility from log returns. */
export function annualizedVolatility(returns: number[], periodsPerYear = 365 * 24): number {
  if (returns.length < 2) return 0;
  return stdDev(returns) * Math.sqrt(periodsPerYear) * 100;
}

/** Max drawdown from a price series (%). */
export function maxDrawdown(prices: number[]): number {
  if (prices.length < 2) return 0;
  let peak = prices[0];
  let dd = 0;
  for (const p of prices) {
    if (p > peak) peak = p;
    const cur = ((peak - p) / peak) * 100;
    if (cur > dd) dd = cur;
  }
  return dd;
}

/** Percentile rank of a value within a sorted array. */
export function percentileRank(sorted: number[], value: number): number {
  if (sorted.length === 0) return 50;
  let cnt = 0;
  for (const v of sorted) { if (v <= value) cnt++; }
  return (cnt / sorted.length) * 100;
}

/** Basis points between two prices. */
export function basisPoints(a: number, b: number): number {
  const mid = (a + b) / 2;
  if (mid === 0) return 0;
  return (Math.abs(a - b) / mid) * 10_000;
}

/** Weighted average. */
export function weightedAvg(vals: number[], wts: number[]): number {
  if (vals.length === 0 || vals.length !== wts.length) return 0;
  const tw = wts.reduce((s, w) => s + w, 0);
  if (tw === 0) return 0;
  return vals.reduce((s, v, i) => s + v * wts[i], 0) / tw;
}

/** Clamp number into [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/** Round to N decimals. */
export function round(v: number, d = 2): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}