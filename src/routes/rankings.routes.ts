import { Router } from "express";
import { marketRegistry } from "../config/markets";
import { liquidityService } from "../services/liquidity.service";
import { volatilityService } from "../services/volatility.service";
import { microstructureService } from "../services/microstructure.service";
import { resolveMarket, BadRequestError } from "../middleware/error";
import { overallHealthScore } from "../utils/scoring";
import { round } from "../utils/math";

const router = Router();

router.get("/liquidity", async (req, res, next) => {
  try {
    const typeFilter = req.query.type as string | undefined;
    let markets = marketRegistry.getAll();
    if (typeFilter) markets = markets.filter((m) => m.type === typeFilter);

    const results = await Promise.all(markets.map(async (m) => {
      const s = await liquidityService.getScore(m);
      return { market_id: m.marketId, market_name: m.ticker, market_type: m.type, score: s.liquidity_score };
    }));
    results.sort((a, b) => b.score - a.score);
    res.json({
      metric: "liquidity", market_type_filter: typeFilter || null, count: results.length,
      timestamp: new Date().toISOString(),
      rankings: results.map((r, i) => ({ rank: i + 1, ...r })),
    });
  } catch (e) { next(e); }
});

router.get("/volatility", async (req, res, next) => {
  try {
    const typeFilter = req.query.type as string | undefined;
    let markets = marketRegistry.getAll();
    if (typeFilter) markets = markets.filter((m) => m.type === typeFilter);

    const results = await Promise.all(markets.map(async (m) => {
      const v = await volatilityService.getCurrent(m);
      return { market_id: m.marketId, market_name: m.ticker, market_type: m.type, score: v.volatility_score };
    }));
    results.sort((a, b) => b.score - a.score);
    res.json({
      metric: "volatility", market_type_filter: typeFilter || null, count: results.length,
      timestamp: new Date().toISOString(),
      rankings: results.map((r, i) => ({ rank: i + 1, ...r })),
    });
  } catch (e) { next(e); }
});

router.get("/compare", async (req, res, next) => {
  try {
    const raw = req.query.markets as string;
    if (!raw) throw new BadRequestError("'markets' query param required", "Example: ?markets=INJ/USDT,BTC/USDT PERP");
    const ids = raw.split(",").map((s) => s.trim());
    if (ids.length < 2) throw new BadRequestError("Provide at least 2 markets to compare");

    const results = await Promise.all(ids.map(async (id) => {
      const m = resolveMarket(id);
      const [liq, vol, mom] = await Promise.all([
        liquidityService.getScore(m), volatilityService.getCurrent(m), microstructureService.getMomentum(m),
      ]);
      const health = overallHealthScore(liq.liquidity_score, vol.volatility_score, mom.momentum_score);
      return {
        market_id: m.marketId, market_name: m.ticker, market_type: m.type,
        scores: { liquidity: liq.liquidity_score, volatility: vol.volatility_score, momentum: mom.momentum_score, overall_health: health },
        quick_stats: { price_usd: 0, volume_24h_usd: round(liq.metrics.bid_depth_usd + liq.metrics.ask_depth_usd), spread_bps: liq.metrics.spread_bps },
      };
    }));
    res.json({ count: results.length, timestamp: new Date().toISOString(), markets: results });
  } catch (e) { next(e); }
});

export default router;