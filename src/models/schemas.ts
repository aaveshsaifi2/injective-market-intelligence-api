import { z } from "zod";

const Timestamp = z.object({ timestamp: z.string(), cache_ttl_seconds: z.number().int(), data_source: z.string() });
const MarketId = z.object({ market_id: z.string(), market_name: z.string(), market_type: z.enum(["spot", "derivative"]) });

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]), version: z.string(), uptime_seconds: z.number(),
  network: z.string(), tracked_markets: z.number().int(), timestamp: z.string(),
});

export const MarketInfoSchema = MarketId.extend({
  base_symbol: z.string(), quote_symbol: z.string(), base_decimals: z.number().int(), quote_decimals: z.number().int(),
  links: z.object({ summary: z.string(), liquidity: z.string(), volatility: z.string(), microstructure: z.string() }),
});

export const LiquidityScoreSchema = MarketId.merge(Timestamp).extend({
  liquidity_score: z.number(), score_label: z.enum(["Excellent", "Good", "Fair", "Poor", "Critical"]),
  components: z.object({ depth_score: z.number(), spread_score: z.number(), resilience_score: z.number() }),
  metrics: z.object({
    bid_depth_usd: z.number(), ask_depth_usd: z.number(), depth_imbalance_pct: z.number(),
    spread_bps: z.number(), spread_percentile_24h: z.number(),
    estimated_slippage_1k_bps: z.number(), estimated_slippage_10k_bps: z.number(), estimated_slippage_50k_bps: z.number(),
  }),
});

export const DepthAnalysisSchema = MarketId.merge(Timestamp).extend({
  levels: z.array(z.object({
    distance_from_mid_pct: z.number(), bid_volume_usd: z.number(), ask_volume_usd: z.number(),
    cumulative_bid_usd: z.number(), cumulative_ask_usd: z.number(),
  })),
  total_bid_depth_usd: z.number(), total_ask_depth_usd: z.number(),
});

export const SlippageEstimateSchema = MarketId.merge(Timestamp).extend({
  trade_size_usd: z.number(), side: z.enum(["buy", "sell"]),
  estimated_slippage_bps: z.number(), estimated_avg_price: z.number(),
  mid_price: z.number(), effective_price_impact_pct: z.number(), fillable: z.boolean(),
});

export const SpreadAnalysisSchema = MarketId.merge(Timestamp).extend({
  current_spread_bps: z.number(), mid_price: z.number(), best_bid: z.number(), best_ask: z.number(),
  average_spread_1h_bps: z.number(), average_spread_24h_bps: z.number(), spread_stability_score: z.number(),
});

const VolRegime = z.enum(["low", "medium", "high", "extreme"]);

export const VolatilityCurrentSchema = MarketId.merge(Timestamp).extend({
  volatility_score: z.number(), regime: VolRegime, regime_confidence: z.number(),
  metrics: z.object({
    volatility_1h_annualized: z.number(), volatility_24h_annualized: z.number(),
    volatility_7d_annualized: z.number(), current_return_1h_pct: z.number(), max_drawdown_24h_pct: z.number(),
  }),
});

export const VolatilityRegimeSchema = MarketId.merge(Timestamp).extend({
  regime: VolRegime, regime_confidence: z.number(), regime_since: z.string(), regime_duration_hours: z.number(),
  metrics: z.object({
    volatility_1h_annualized: z.number(), volatility_24h_annualized: z.number(), volatility_7d_annualized: z.number(),
    regime_thresholds: z.object({
      low: z.object({ max: z.number() }), medium: z.object({ min: z.number(), max: z.number() }),
      high: z.object({ min: z.number(), max: z.number() }), extreme: z.object({ min: z.number() }),
    }),
  }),
  previous_regime: z.object({ regime: VolRegime, ended_at: z.string(), duration_hours: z.number() }).nullable(),
});

export const VolatilityHistorySchema = MarketId.merge(Timestamp).extend({
  period: z.string(),
  data_points: z.array(z.object({ timestamp: z.string(), volatility_annualized: z.number(), regime: VolRegime, price: z.number() })),
});

const FlowWindow = z.object({
  buy_volume_usd: z.number(), sell_volume_usd: z.number(), buy_count: z.number().int(), sell_count: z.number().int(),
  net_flow_usd: z.number(), imbalance_ratio: z.number(),
});

export const FlowAnalysisSchema = MarketId.merge(Timestamp).extend({
  flow_score: z.number(), flow_direction: z.enum(["buy_dominant", "sell_dominant", "neutral"]),
  windows: z.object({ "5m": FlowWindow, "1h": FlowWindow, "24h": FlowWindow }),
  whale_trades_1h: z.number().int(), whale_threshold_usd: z.number(),
});

export const WhaleTradesSchema = MarketId.merge(Timestamp).extend({
  whale_threshold_usd: z.number(), period_hours: z.number(), total_whale_trades: z.number().int(),
  whale_buy_volume_usd: z.number(), whale_sell_volume_usd: z.number(),
  trades: z.array(z.object({
    timestamp: z.string(), side: z.enum(["buy", "sell"]), quantity: z.number(),
    price: z.number(), volume_usd: z.number(), size_multiple: z.number(),
  })),
});

export const MomentumSchema = MarketId.merge(Timestamp).extend({
  momentum_score: z.number(),
  momentum_label: z.enum(["strong_bearish", "bearish", "neutral", "bullish", "strong_bullish"]),
  indicators: z.object({
    price_change_5m_pct: z.number(), price_change_1h_pct: z.number(), price_change_24h_pct: z.number(),
    volume_trend: z.enum(["increasing", "decreasing", "stable"]), trade_flow_bias: z.number(),
  }),
});

export const MarketSummarySchema = MarketId.merge(Timestamp).extend({
  scores: z.object({ liquidity: z.number(), volatility: z.number(), momentum: z.number(), overall_health: z.number() }),
  quick_stats: z.object({
    price_usd: z.number(), change_24h_pct: z.number(), volume_24h_usd: z.number(),
    spread_bps: z.number(), volatility_regime: VolRegime,
  }),
  alerts: z.array(z.object({ type: z.string(), message: z.string(), severity: z.enum(["info", "warning", "critical"]) })),
  links: z.object({ liquidity: z.string(), volatility: z.string(), microstructure: z.string() }),
});

export const RankingsResponseSchema = z.object({
  metric: z.string(), market_type_filter: z.string().nullable(), count: z.number().int(), timestamp: z.string(),
  rankings: z.array(z.object({ rank: z.number().int(), market_id: z.string(), market_name: z.string(), market_type: z.enum(["spot", "derivative"]), score: z.number() })),
});

export const CompareResponseSchema = z.object({
  count: z.number().int(), timestamp: z.string(),
  markets: z.array(MarketId.extend({
    scores: z.object({ liquidity: z.number(), volatility: z.number(), momentum: z.number(), overall_health: z.number() }),
    quick_stats: z.object({ price_usd: z.number(), volume_24h_usd: z.number(), spread_bps: z.number() }),
  })),
});

export const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.string().optional() }),
  timestamp: z.string(),
});