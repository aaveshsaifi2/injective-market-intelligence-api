import { Router } from "express";
import { resolveMarket } from "../middleware/error";
import { microstructureService } from "../services/microstructure.service";

const router = Router();

/**
 * @swagger
 * /v1/microstructure/{market_id}/flow:
 *   get:
 *     summary: Get order flow analysis
 *     tags: [Microstructure]
 *     parameters:
 *       - in: path
 *         name: market_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Flow imbalance metrics
 */

/**
 * @swagger
 * /v1/microstructure/{market_id}/whales:
 *   get:
 *     summary: Get whale trade analysis
 *     tags: [Microstructure]
 *     parameters:
 *       - in: path
 *         name: market_id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: hours
 *         schema:
 *           type: number
 *           example: 24
 *         description: Time window in hours
 *     responses:
 *       200:
 *         description: Whale activity report
 */

/**
 * @swagger
 * /v1/microstructure/{market_id}/momentum:
 *   get:
 *     summary: Get momentum score
 *     tags: [Microstructure]
 *     parameters:
 *       - in: path
 *         name: market_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Momentum indicators
 */


router.get("/:market_id/flow", async (req, res, next) => {
  try { res.json(await microstructureService.getFlow(resolveMarket(req.params.market_id))); }
  catch (e) { next(e); }
});

router.get("/:market_id/whales", async (req, res, next) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    res.json(await microstructureService.getWhales(resolveMarket(req.params.market_id), hours));
  } catch (e) { next(e); }
});

router.get("/:market_id/momentum", async (req, res, next) => {
  try { res.json(await microstructureService.getMomentum(resolveMarket(req.params.market_id))); }
  catch (e) { next(e); }
});

export default router;