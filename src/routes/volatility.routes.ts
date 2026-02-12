import { Router } from "express";
import { resolveMarket } from "../middleware/error";
import { volatilityService } from "../services/volatility.service";

const router = Router();
/**
 * @swagger
 * /v1/volatility/{market_id}/current:
 *   get:
 *     summary: Get current volatility metrics
 *     tags: [Volatility]
 *     parameters:
 *       - in: path
 *         name: market_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Current volatility state
 */

/**
 * @swagger
 * /v1/volatility/{market_id}/regime:
 *   get:
 *     summary: Get volatility regime tracking
 *     tags: [Volatility]
 *     parameters:
 *       - in: path
 *         name: market_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Volatility regime info
 */

/**
 * @swagger
 * /v1/volatility/{market_id}/history:
 *   get:
 *     summary: Get historical volatility data
 *     tags: [Volatility]
 *     parameters:
 *       - in: path
 *         name: market_id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           example: 7d
 *         description: Historical period (e.g. 7d, 30d)
 *     responses:
 *       200:
 *         description: Historical volatility data points
 */


router.get("/:market_id/current", async (req, res, next) => {
  try { res.json(await volatilityService.getCurrent(resolveMarket(req.params.market_id))); }
  catch (e) { next(e); }
});

router.get("/:market_id/regime", async (req, res, next) => {
  try { res.json(await volatilityService.getRegime(resolveMarket(req.params.market_id))); }
  catch (e) { next(e); }
});

router.get("/:market_id/history", async (req, res, next) => {
  try {
    const period = (req.query.period as string) || "7d";
    res.json(await volatilityService.getHistory(resolveMarket(req.params.market_id), period));
  } catch (e) { next(e); }
});

export default router;