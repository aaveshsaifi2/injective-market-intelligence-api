import { Router } from "express";
import { marketRegistry } from "../config/markets";
import { injectiveService } from "../services/injective.service";

const router = Router();
const START = Date.now();

/**
 * @swagger
 * /v1/health:
 *   get:
 *     summary: API health check
 *     description: Returns service uptime, Injective network, and tracked market stats.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Health status object
 *         content:
 *           application/json:
 *             example:
 *               status: "ok"
 *               version: "1.0.0"
 *               uptime_seconds: 1234
 *               network: "Mainnet"
 *               tracked_markets: 150
 *               market_breakdown:
 *                 spot: 80
 *                 derivative: 70
 *               discovery_complete: true
 *               timestamp: "2026-02-13T10:00:00.000Z"
 */
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
