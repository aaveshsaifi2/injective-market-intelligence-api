import { Router } from "express";
import { marketRegistry } from "../config/markets";
import { resolveMarket } from "../middleware/error";
import { liquidityService } from "../services/liquidity.service";
import { volatilityService } from "../services/volatility.service";
import { microstructureService } from "../services/microstructure.service";
import { overallHealthScore } from "../utils/scoring";
import { round } from "../utils/math";

const router = Router();

/**
 * @swagger
 * /v1/markets:
 *   get:
 *     summary: List all tracked markets
 *     tags: [Markets]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [spot, derivative]
 *         description: Filter by market type
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by ticker or symbol
 *     responses:
 *       200:
 *         description: List of markets
 */


/**
 * @swagger
 * /v1/markets/{market_id}/summary:
 *   get:
 *     summary: Get overall market intelligence summary
 *     tags: [Markets]
 *     parameters:
 *       - in: path
 *         name: market_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Market ID or ticker (e.g. INJ/USDT)
 *     responses:
 *       200:
 *         description: Market intelligence summary
 *       404:
 *         description: Market not found
 */


/** GET /v1/markets — list all tracked markets */
router.get("/", (req, res) => {
  const typeFilter = req.query.type as string | undefined;
  const search = req.query.search as string | undefined;

  let markets = search ? marketRegistry.search(search) : marketRegistry.getAll();
  if (typeFilter) markets = markets.filter((m) => m.type === typeFilter);

  const result = markets.map((m) => ({
    market_id: m.marketId, market_name: m.ticker, market_type: m.type,
    base_symbol: m.baseSymbol, quote_symbol: m.quoteSymbol,
    base_decimals: m.baseDecimals, quote_decimals: m.quoteDecimals,
    links: {
      summary: `/v1/markets/${m.marketId}/summary`,
      liquidity: `/v1/liquidity/${m.marketId}/score`,
      volatility: `/v1/volatility/${m.marketId}/current`,
      microstructure: `/v1/microstructure/${m.marketId}/flow`,
    },
  }));
  res.json({ count: result.length, markets: result });
});

/** GET /v1/markets/:market_id/summary */
router.get("/:market_id/summary", async (req, res, next) => {
  try {
    const market = resolveMarket(req.params.market_id);
    const [liq, vol, mom] = await Promise.all([
      liquidityService.getScore(market),
      volatilityService.getCurrent(market),
      microstructureService.getMomentum(market),
    ]);
    const health = overallHealthScore(liq.liquidity_score, vol.volatility_score, mom.momentum_score);
    const alerts: any[] = [];
    if (liq.liquidity_score < 30) alerts.push({ type: "low_liquidity", message: `Liquidity score is ${liq.liquidity_score} (${liq.score_label})`, severity: "warning" });
    if (vol.regime === "extreme") alerts.push({ type: "extreme_volatility", message: "Market is in extreme volatility regime", severity: "critical" });
    if (Math.abs(mom.momentum_score) > 60) alerts.push({ type: "strong_momentum", message: `Strong ${mom.momentum_label} momentum (score: ${mom.momentum_score})`, severity: "info" });

    res.json({
      market_id: market.marketId, market_name: market.ticker, market_type: market.type,
      timestamp: new Date().toISOString(), cache_ttl_seconds: 30, data_source: `injective-${config.network}`,
      scores: { liquidity: liq.liquidity_score, volatility: vol.volatility_score, momentum: mom.momentum_score, overall_health: health },
      quick_stats: {
        price_usd: 0, change_24h_pct: round(mom.indicators.price_change_24h_pct, 2),
        volume_24h_usd: round(liq.metrics.bid_depth_usd + liq.metrics.ask_depth_usd),
        spread_bps: liq.metrics.spread_bps, volatility_regime: vol.regime,
      },
      alerts,
      links: {
        liquidity: `/v1/liquidity/${market.marketId}/score`,
        volatility: `/v1/volatility/${market.marketId}/current`,
        microstructure: `/v1/microstructure/${market.marketId}/flow`,
      },
    });
  } catch (e) { next(e); }
});

// Need config for data_source
import { config } from "../config";

export default router;