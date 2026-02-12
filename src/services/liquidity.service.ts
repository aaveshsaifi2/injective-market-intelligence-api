import { injectiveService, OrderbookData, TradeData } from "./injective.service";
import { MarketMeta } from "../config/markets";
import { config } from "../config";
import { cacheService } from "./cache.service";
import { round, basisPoints, mean, percentileRank } from "../utils/math";
import { sigmoidScore, linearScore, compositeLiquidityScore, liquidityLabel } from "../utils/scoring";

interface OBLevel { price: number; quantity: number; timestamp: number; }

class LiquidityService {

  async getScore(market: MarketMeta) {
    return cacheService.getOrCompute(`liq:score:${market.marketId}`, () => this._score(market), config.cache.computedTtl);
  }
  async getDepth(market: MarketMeta) {
    return cacheService.getOrCompute(`liq:depth:${market.marketId}`, () => this._depth(market), config.cache.computedTtl);
  }
  async getSlippage(market: MarketMeta, sizeUsd: number, side: "buy" | "sell" = "buy") {
    return cacheService.getOrCompute(`liq:slip:${market.marketId}:${sizeUsd}:${side}`, () => this._slippage(market, sizeUsd, side), config.cache.orderbookTtl);
  }
  async getSpread(market: MarketMeta) {
    return cacheService.getOrCompute(`liq:spr:${market.marketId}`, () => this._spread(market), config.cache.computedTtl);
  }

  private async _score(m: MarketMeta) {
    const ob = await injectiveService.fetchOrderbook(m);
    const trades = await injectiveService.fetchTrades(m, 100);
    const mid = this.mid(ob);
    const bidD = this.depthUsd(ob.buys); const askD = this.depthUsd(ob.sells);
    const total = bidD + askD;
    const imbal = total > 0 ? ((bidD - askD) / total) * 100 : 0;
    const spr = this.spreadBps(ob);
    const s1k = this.simSlip(ob.sells, mid, 1000);
    const s10k = this.simSlip(ob.sells, mid, 10000);
    const s50k = this.simSlip(ob.sells, mid, 50000);
    const dScore = sigmoidScore(total, 100000, 2);
    const spScore = linearScore(spr, 50, 1, true);
    const rScore = this.resilience(ob, trades);
    const score = compositeLiquidityScore(dScore, spScore, rScore);
    const histSpr = this.histSpreads(trades);
    const sprPct = round(percentileRank(histSpr.sort((a, b) => a - b), spr));

    return {
      market_id: m.marketId, market_name: m.ticker, market_type: m.type,
      timestamp: new Date().toISOString(), cache_ttl_seconds: config.cache.computedTtl, data_source: `injective-${config.network}`,
      liquidity_score: score, score_label: liquidityLabel(score),
      components: { depth_score: dScore, spread_score: spScore, resilience_score: rScore },
      metrics: {
        bid_depth_usd: round(bidD), ask_depth_usd: round(askD), depth_imbalance_pct: round(imbal),
        spread_bps: round(spr, 1), spread_percentile_24h: sprPct,
        estimated_slippage_1k_bps: round(s1k, 1), estimated_slippage_10k_bps: round(s10k, 1), estimated_slippage_50k_bps: round(s50k, 1),
      },
    };
  }

  private async _depth(m: MarketMeta) {
    const ob = await injectiveService.fetchOrderbook(m);
    const mid = this.mid(ob);
    const dists = [0.1, 0.5, 1, 2, 5];
    let cBid = 0, cAsk = 0;
    const levels = dists.map((d) => {
      const bv = this.volWithin(ob.buys, mid, d); const av = this.volWithin(ob.sells, mid, d);
      cBid += bv; cAsk += av;
      return { distance_from_mid_pct: d, bid_volume_usd: round(bv), ask_volume_usd: round(av), cumulative_bid_usd: round(cBid), cumulative_ask_usd: round(cAsk) };
    });
    return {
      market_id: m.marketId, market_name: m.ticker, market_type: m.type,
      timestamp: new Date().toISOString(), cache_ttl_seconds: config.cache.computedTtl, data_source: `injective-${config.network}`,
      levels, total_bid_depth_usd: round(this.depthUsd(ob.buys)), total_ask_depth_usd: round(this.depthUsd(ob.sells)),
    };
  }

  private async _slippage(m: MarketMeta, sizeUsd: number, side: "buy" | "sell") {
    const ob = await injectiveService.fetchOrderbook(m);
    const mid = this.mid(ob);
    const levels = side === "buy" ? ob.sells : ob.buys;
    let rem = sizeUsd, cost = 0, qty = 0, fillable = true;
    for (const l of levels) {
      if (rem <= 0) break;
      const lv = l.price * l.quantity; const f = Math.min(rem, lv);
      cost += f; qty += f / l.price; rem -= f;
    }
    if (rem > 0) fillable = false;
    const avg = qty > 0 ? cost / qty : mid;
    const slip = mid > 0 ? Math.abs(((avg - mid) / mid) * 10000) : 0;
    return {
      market_id: m.marketId, market_name: m.ticker, market_type: m.type,
      timestamp: new Date().toISOString(), cache_ttl_seconds: config.cache.orderbookTtl, data_source: `injective-${config.network}`,
      trade_size_usd: sizeUsd, side, estimated_slippage_bps: round(slip, 1),
      estimated_avg_price: round(avg, 6), mid_price: round(mid, 6),
      effective_price_impact_pct: round(slip / 100, 3), fillable,
    };
  }

  private async _spread(m: MarketMeta) {
    const ob = await injectiveService.fetchOrderbook(m);
    const trades = await injectiveService.fetchTrades(m, 100);
    const mid = this.mid(ob);
    const bb = ob.buys[0]?.price || 0; const ba = ob.sells[0]?.price || 0;
    const curSpr = basisPoints(bb, ba);
    const hist = this.histSpreads(trades);
    const avg1h = mean(hist.slice(0, 20)); const avg24h = mean(hist);
    const variation = hist.length > 0 ? Math.max(...hist) - Math.min(...hist) : 0;
    const stability = linearScore(variation, 50, 0, true);
    return {
      market_id: m.marketId, market_name: m.ticker, market_type: m.type,
      timestamp: new Date().toISOString(), cache_ttl_seconds: config.cache.computedTtl, data_source: `injective-${config.network}`,
      current_spread_bps: round(curSpr, 1), mid_price: round(mid, 6), best_bid: round(bb, 6), best_ask: round(ba, 6),
      average_spread_1h_bps: round(avg1h, 1), average_spread_24h_bps: round(avg24h, 1), spread_stability_score: stability,
    };
  }

  private mid(ob: OrderbookData): number {
    const b = ob.buys[0]?.price || 0, a = ob.sells[0]?.price || 0;
    if (!b && !a) return 0; if (!b) return a; if (!a) return b; return (b + a) / 2;
  }
  private depthUsd(levels: OBLevel[]): number { return levels.reduce((s, l) => s + l.price * l.quantity, 0); }
  private spreadBps(ob: OrderbookData): number { return basisPoints(ob.buys[0]?.price || 0, ob.sells[0]?.price || 0); }
  private simSlip(levels: OBLevel[], mid: number, size: number): number {
    let rem = size, cost = 0, qty = 0;
    for (const l of levels) { if (rem <= 0) break; const f = Math.min(rem, l.price * l.quantity); cost += f; qty += f / l.price; rem -= f; }
    const avg = qty > 0 ? cost / qty : mid; return mid > 0 ? Math.abs(((avg - mid) / mid) * 10000) : 0;
  }
  private volWithin(levels: OBLevel[], mid: number, distPct: number): number {
    if (mid === 0) return 0;
    return levels.filter((l) => (Math.abs(l.price - mid) / mid) * 100 <= distPct).reduce((s, l) => s + l.price * l.quantity, 0);
  }
  private resilience(ob: OrderbookData, trades: TradeData[]): number {
    const lvl = sigmoidScore(ob.buys.length + ob.sells.length, 30, 2);
    const freq = sigmoidScore(trades.length, 50, 1.5);
    return round(lvl * 0.6 + freq * 0.4);
  }
  private histSpreads(trades: TradeData[]): number[] {
    const s: number[] = [];
    for (let i = 1; i < trades.length; i++) {
      if (trades[i].tradeDirection !== trades[i - 1].tradeDirection && trades[i].price > 0 && trades[i - 1].price > 0)
        s.push(basisPoints(trades[i].price, trades[i - 1].price));
    }
    return s.length > 0 ? s : [5];
  }
}

export const liquidityService = new LiquidityService();