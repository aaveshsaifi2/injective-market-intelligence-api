import { injectiveService, TradeData } from "./injective.service";
import { MarketMeta } from "../config/markets";
import { config } from "../config";
import { cacheService } from "./cache.service";
import { round, mean } from "../utils/math";
import { sigmoidScore, momentumScore, momentumLabel } from "../utils/scoring";

class MicrostructureService {

  async getFlow(m: MarketMeta) {
    return cacheService.getOrCompute(`ms:flow:${m.marketId}`, () => this._flow(m), config.cache.computedTtl);
  }
  async getWhales(m: MarketMeta, hours = 24) {
    return cacheService.getOrCompute(`ms:whale:${m.marketId}:${hours}`, () => this._whales(m, hours), config.cache.computedTtl);
  }
  async getMomentum(m: MarketMeta) {
    return cacheService.getOrCompute(`ms:mom:${m.marketId}`, () => this._momentum(m), config.cache.computedTtl);
  }

  private async _flow(m: MarketMeta) {
    const trades = await injectiveService.fetchTrades(m, 500);
    const now = Date.now();
    const w5m = this.age(trades, now, 5 * 60_000);
    const w1h = this.age(trades, now, 3600_000);

    const calc = (t: TradeData[]) => {
      const buys = t.filter((x) => x.tradeDirection === "buy");
      const sells = t.filter((x) => x.tradeDirection === "sell");
      const bv = buys.reduce((s, x) => s + x.price * x.quantity, 0);
      const sv = sells.reduce((s, x) => s + x.price * x.quantity, 0);
      const tot = bv + sv;
      return {
        buy_volume_usd: round(bv), sell_volume_usd: round(sv),
        buy_count: buys.length, sell_count: sells.length,
        net_flow_usd: round(bv - sv), imbalance_ratio: tot > 0 ? round(bv / tot, 3) : 0.5,
      };
    };

    const f5m = calc(w5m), f1h = calc(w1h), f24h = calc(trades);
    const score = round(f1h.imbalance_ratio * 100);
    let dir: "buy_dominant" | "sell_dominant" | "neutral" = "neutral";
    if (score > 55) dir = "buy_dominant"; else if (score < 45) dir = "sell_dominant";
    const thresh = this.whaleThreshold(w1h);
    const wc = w1h.filter((t) => t.price * t.quantity >= thresh).length;

    return {
      market_id: m.marketId, market_name: m.ticker, market_type: m.type,
      timestamp: new Date().toISOString(), cache_ttl_seconds: config.cache.computedTtl, data_source: `injective-${config.network}`,
      flow_score: score, flow_direction: dir,
      windows: { "5m": f5m, "1h": f1h, "24h": f24h },
      whale_trades_1h: wc, whale_threshold_usd: round(thresh),
    };
  }

  private async _whales(m: MarketMeta, hours: number) {
    const trades = await injectiveService.fetchTrades(m, 500);
    const cutoff = Date.now() - hours * 3600_000;
    const period = trades.filter((t) => t.timestamp * 1000 >= cutoff);
    const thresh = this.whaleThreshold(period);
    const wt = period.filter((t) => t.price * t.quantity >= thresh);
    const avg = period.length > 0 ? mean(period.map((t) => t.price * t.quantity)) : 1;
    const bv = wt.filter((t) => t.tradeDirection === "buy").reduce((s, t) => s + t.price * t.quantity, 0);
    const sv = wt.filter((t) => t.tradeDirection === "sell").reduce((s, t) => s + t.price * t.quantity, 0);

    return {
      market_id: m.marketId, market_name: m.ticker, market_type: m.type,
      timestamp: new Date().toISOString(), cache_ttl_seconds: config.cache.computedTtl, data_source: `injective-${config.network}`,
      whale_threshold_usd: round(thresh), period_hours: hours, total_whale_trades: wt.length,
      whale_buy_volume_usd: round(bv), whale_sell_volume_usd: round(sv),
      trades: wt.slice(0, 20).map((t) => ({
        timestamp: new Date(t.timestamp * 1000).toISOString(),
        side: t.tradeDirection as "buy" | "sell", quantity: round(t.quantity, 4),
        price: round(t.price, 4), volume_usd: round(t.price * t.quantity), size_multiple: round((t.price * t.quantity) / avg, 1),
      })),
    };
  }

  private async _momentum(m: MarketMeta) {
    const trades = await injectiveService.fetchTrades(m, 500);
    const summary = await injectiveService.fetchMarketSummary(m);
    const now = Date.now();
    const t5m = this.age(trades, now, 5 * 60_000);
    const t1h = this.age(trades, now, 3600_000);
    const pNow = trades[0]?.price || 0;
    const p5m = t5m.length > 0 ? t5m[t5m.length - 1].price : pNow;
    const p1h = t1h.length > 0 ? t1h[t1h.length - 1].price : pNow;
    const c5m = p5m > 0 ? ((pNow - p5m) / p5m) * 100 : 0;
    const c1h = p1h > 0 ? ((pNow - p1h) / p1h) * 100 : 0;
    const c24h = summary.change || 0;

    const half = Math.floor(trades.length / 2);
    const v1 = trades.slice(half).reduce((s, t) => s + t.price * t.quantity, 0);
    const v2 = trades.slice(0, half).reduce((s, t) => s + t.price * t.quantity, 0);
    let vt: "increasing" | "decreasing" | "stable" = "stable";
    if (v1 > 0) { const vc = (v2 - v1) / v1; if (vc > 0.15) vt = "increasing"; else if (vc < -0.15) vt = "decreasing"; }

    const rb = t1h.filter((t) => t.tradeDirection === "buy").length;
    const fb = (rb / (t1h.length || 1) - 0.5) * 2;
    const score = momentumScore(c5m, c1h, c24h, fb);

    return {
      market_id: m.marketId, market_name: m.ticker, market_type: m.type,
      timestamp: new Date().toISOString(), cache_ttl_seconds: config.cache.computedTtl, data_source: `injective-${config.network}`,
      momentum_score: score, momentum_label: momentumLabel(score),
      indicators: { price_change_5m_pct: round(c5m, 3), price_change_1h_pct: round(c1h, 3), price_change_24h_pct: round(c24h, 3), volume_trend: vt, trade_flow_bias: round(fb, 3) },
    };
  }

  private age(trades: TradeData[], now: number, ms: number): TradeData[] {
    return trades.filter((t) => t.timestamp * 1000 >= now - ms);
  }
  private whaleThreshold(trades: TradeData[]): number {
    if (trades.length === 0) return 5000;
    const sizes = trades.map((t) => t.price * t.quantity).sort((a, b) => a - b);
    const p95 = sizes[Math.floor(sizes.length * 0.95)] || mean(sizes) * 3;
    return Math.max(p95, 5000);
  }
}

export const microstructureService = new MicrostructureService();