import { Router } from "express";
import { marketRegistry } from "../config/markets";
import { injectiveService } from "../services/injective.service";

const router = Router();
const START = Date.now();

router.get("/", (_req, res) => {
  const stats = marketRegistry.stats();
  res.json({
    status: "ok",
    version: "1.0.0",
    uptime_seconds: Math.floor((Date.now() - START) / 1000),
    network: injectiveService.getNetworkName(),
    tracked_markets: stats.total,
    market_breakdown: { spot: stats.spot, derivative: stats.derivative },
    discovery_complete: stats.discovered,
    timestamp: new Date().toISOString(),
  });
});

export default router;