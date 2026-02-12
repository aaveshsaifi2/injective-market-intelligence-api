import { clamp, round, weightedAvg } from "./math";

/** Sigmoid score: good for unbounded metrics. midpoint → 50. */
export function sigmoidScore(value: number, midpoint: number, steepness = 1): number {
  const x = (steepness * (value - midpoint)) / midpoint;
  return round(clamp(100 / (1 + Math.exp(-x)), 0, 100));
}

/** Linear score between min→0 and max→100. invert flips direction. */
export function linearScore(value: number, min: number, max: number, invert = false): number {
  if (max === min) return 50;
  let n = ((value - min) / (max - min)) * 100;
  if (invert) n = 100 - n;
  return round(clamp(n, 0, 100));
}

/* ---- Liquidity ---- */
export function compositeLiquidityScore(depth: number, spread: number, resilience: number): number {
  return round(weightedAvg([depth, spread, resilience], [0.4, 0.35, 0.25]));
}

export function liquidityLabel(score: number): "Excellent" | "Good" | "Fair" | "Poor" | "Critical" {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  if (score >= 20) return "Poor";
  return "Critical";
}

/* ---- Volatility ---- */
export function volatilityRegime(vol: number): "low" | "medium" | "high" | "extreme" {
  if (vol < 20) return "low";
  if (vol < 50) return "medium";
  if (vol < 80) return "high";
  return "extreme";
}

export function regimeConfidence(vol: number): number {
  const bands = [
    { r: "low" as const, min: 0, max: 20 },
    { r: "medium" as const, min: 20, max: 50 },
    { r: "high" as const, min: 50, max: 80 },
    { r: "extreme" as const, min: 80, max: 200 },
  ];
  const regime = volatilityRegime(vol);
  const b = bands.find((x) => x.r === regime)!;
  const range = b.max - b.min;
  const dist = Math.min(vol - b.min, b.max - vol);
  return round(clamp(dist / (range / 2), 0, 1), 3);
}

export function volatilityScore(vol: number): number {
  return round(linearScore(vol, 0, 150, false));
}

/* ---- Momentum ---- */
export function momentumScore(c5m: number, c1h: number, c24h: number, flow: number): number {
  const w = weightedAvg([c5m * 10, c1h * 5, c24h * 2, flow * 50], [0.3, 0.3, 0.2, 0.2]);
  return round(clamp(w, -100, 100));
}

export function momentumLabel(s: number): "strong_bearish" | "bearish" | "neutral" | "bullish" | "strong_bullish" {
  if (s <= -50) return "strong_bearish";
  if (s <= -15) return "bearish";
  if (s <= 15) return "neutral";
  if (s <= 50) return "bullish";
  return "strong_bullish";
}

/* ---- Overall Health ---- */
export function overallHealthScore(liq: number, vol: number, mom: number): number {
  const volHealth = linearScore(vol, 0, 100, true);
  const momHealth = 50 + Math.abs(50 - Math.abs(mom)) * 0.5;
  return round(weightedAvg([liq, volHealth, momHealth], [0.5, 0.3, 0.2]));
}