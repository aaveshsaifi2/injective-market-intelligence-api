import { injectiveService, TradeData } from "./injective.service";
import { MarketMeta } from "../config/markets";
import { config } from "../config";
import { cacheService } from "./cache.service";
import { round, logReturns, annualizedVolatility, maxDrawdown } from "../utils/math";
import { volatilityRegime, regimeConfidence, volatilityScore } from "../utils/scoring";

interface RegimeState {
  regime: "low" | "medium" | "high" | "extreme";
  since: string;
  prev: { regime: "low" | "medium" | "high" | "extreme"; endedAt: string; durationHours: number } | null;
}
const regimeMap = new Map<string, RegimeState>();

class VolatilityService {

  async getCurrent(m: MarketMeta) {
    return cacheService.getOrCompute(`vol:cur:${m.marketId}`, () => this._current(m), config.cache.computedTtl);
  }
  async getRegime(m: MarketMeta) {
    return cacheService.getOrCompute(`vol:reg:${m.marketId}`, () => this._regime(m), config.cache.computedTtl);
  }
  async getHistory(m: MarketMeta, period = "7d") {
    return cacheService.getOrCompute(`vol:hist:${m.marketId}:${period}`, () => this._history(m, period), config.cache.computedTtl * 2);
  }

  private async _current(m: MarketMeta) {
    const trades = await injectiveService.fetchTrades(m, 500);
    const prices = this.priceSeries(trades);
    const rets = logReturns(prices);
    const now = Date.now();
    const t1h = trades.filter((t) => t.timestamp * 1000 > now - 3600_000);
    const r1h = logReturns(this.priceSeries(t1h));
    const v1h = annualizedVolatility(r1h, 365 * 24);
    const v24h = annualizedVolatility(rets, 365 * 24);
    const v7d = v24h;
    const p1h = this.priceSeries(t1h);
    const ret1h = p1h.length >= 2 ? ((p1h[p1h.length - 1] - p1h[0]) / p1h[0]) * 100 : 0;
    const dd = maxDrawdown(prices);
    const regime = volatilityRegime(v24h);
    this.trackRegime(m.marketId, regime);

    return {
      market_id: m.marketId, market_name: m.ticker, market_type: m.type,
      timestamp: new Date().toISOString(), cache_ttl_seconds: config.cache.computedTtl, data_source: `injective-${config.network}`,
      volatility_score: volatilityScore(v24h), regime, regime_confidence: regimeConfidence(v24h),
      metrics: {
        volatility_1h_annualized: round(v1h, 1), volatility_24h_annualized: round(v24h, 1), volatility_7d_annualized: round(v7d, 1),
        current_return_1h_pct: round(ret1h, 2), max_drawdown_24h_pct: round(dd, 2),
      },
    };
  }

  private async _regime(m: MarketMeta) {
    const trades = await injectiveService.fetchTrades(m, 500);
    const prices = this.priceSeries(trades);
    const rets = logReturns(prices);
    const now = Date.now();
    const r1h = logReturns(this.priceSeries(trades.filter((t) => t.timestamp * 1000 > now - 3600_000)));
    const v1h = annualizedVolatility(r1h, 365 * 24);
    const v24h = annualizedVolatility(rets, 365 * 24);
    const v7d = v24h;
    const regime = volatilityRegime(v24h);
    this.trackRegime(m.marketId, regime);
    const st = regimeMap.get(m.marketId)!;
    const dur = (Date.now() - new Date(st.since).getTime()) / 3600_000;

    return {
      market_id: m.marketId, market_name: m.ticker, market_type: m.type,
      timestamp: new Date().toISOString(), cache_ttl_seconds: config.cache.computedTtl, data_source: `injective-${config.network}`,
      regime, regime_confidence: regimeConfidence(v24h), regime_since: st.since, regime_duration_hours: round(dur, 2),
      metrics: {
        volatility_1h_annualized: round(v1h, 1), volatility_24h_annualized: round(v24h, 1), volatility_7d_annualized: round(v7d, 1),
        regime_thresholds: { low: { max: 20 }, medium: { min: 20, max: 50 }, high: { min: 50, max: 80 }, extreme: { min: 80 } },
      },
      previous_regime: st.prev,
    };
  }

  private async _history(m: MarketMeta, period: string) {
    const trades = await injectiveService.fetchTrades(m, 500);
    const prices = this.priceSeries(trades);
    const ws = 20;
    const pts: any[] = [];
    for (let i = ws; i < prices.length; i += ws) {
      const wp = prices.slice(i - ws, i);
      const v = annualizedVolatility(logReturns(wp), 365 * 24);
      const ts = trades[i] ? trades[i].timestamp * 1000 : Date.now();
      pts.push({ timestamp: new Date(ts).toISOString(), volatility_annualized: round(v, 1), regime: volatilityRegime(v), price: round(wp[wp.length - 1], 4) });
    }
    return {
      market_id: m.marketId, market_name: m.ticker, market_type: m.type,
      timestamp: new Date().toISOString(), cache_ttl_seconds: config.cache.computedTtl * 2, data_source: `injective-${config.network}`,
      period, data_points: pts,
    };
  }

  private priceSeries(trades: TradeData[]): number[] {
    return trades.filter((t) => t.price > 0).map((t) => t.price).reverse();
  }

  private trackRegime(id: string, regime: RegimeState["regime"]) {
    const ex = regimeMap.get(id);
    if (!ex) { regimeMap.set(id, { regime, since: new Date().toISOString(), prev: null }); return; }
    if (ex.regime !== regime) {
      const dur = (Date.now() - new Date(ex.since).getTime()) / 3600_000;
      regimeMap.set(id, { regime, since: new Date().toISOString(), prev: { regime: ex.regime, endedAt: new Date().toISOString(), durationHours: round(dur, 2) } });
    }
  }
}

export const volatilityService = new VolatilityService();