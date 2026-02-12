import { Router } from "express";
import { resolveMarket, BadRequestError } from "../middleware/error";
import { liquidityService } from "../services/liquidity.service";

const router = Router();

/**
 * @swagger
 * /v1/liquidity/{market_id}/score:
 *   get:
 *     summary: Get liquidity score
 *     tags: [Liquidity]
 *     parameters:
 *       - in: path
 *         name: market_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Liquidity score result
 */

/**
 * @swagger
 * /v1/liquidity/{market_id}/depth:
 *   get:
 *     summary: Get orderbook depth analysis
 *     tags: [Liquidity]
 *     parameters:
 *       - in: path
 *         name: market_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Depth breakdown across distance bands
 */

/**
 * @swagger
 * /v1/liquidity/{market_id}/slippage:
 *   get:
 *     summary: Estimate slippage for a given trade size
 *     tags: [Liquidity]
 *     parameters:
 *       - in: path
 *         name: market_id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: size
 *         required: true
 *         schema:
 *           type: number
 *         description: Trade size in USD
 *       - in: query
 *         name: side
 *         schema:
 *           type: string
 *           enum: [buy, sell]
 *     responses:
 *       200:
 *         description: Slippage estimate result
 */

/**
 * @swagger
 * /v1/liquidity/{market_id}/spread:
 *   get:
 *     summary: Get spread analytics
 *     tags: [Liquidity]
 *     parameters:
 *       - in: path
 *         name: market_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Spread statistics and stability metrics
 */


router.get("/:market_id/score", async (req, res, next) => {
  try { res.json(await liquidityService.getScore(resolveMarket(req.params.market_id))); }
  catch (e) { next(e); }
});

router.get("/:market_id/depth", async (req, res, next) => {
  try { res.json(await liquidityService.getDepth(resolveMarket(req.params.market_id))); }
  catch (e) { next(e); }
});

router.get("/:market_id/slippage", async (req, res, next) => {
  try {
    const market = resolveMarket(req.params.market_id);
    const size = parseFloat(req.query.size as string);
    if (!size || size <= 0) throw new BadRequestError("'size' query param required (> 0)", "Example: ?size=10000&side=buy");
    const side = (req.query.side as string)?.toLowerCase() === "sell" ? "sell" : "buy";
    res.json(await liquidityService.getSlippage(market, size, side as "buy" | "sell"));
  } catch (e) { next(e); }
});

router.get("/:market_id/spread", async (req, res, next) => {
  try { res.json(await liquidityService.getSpread(resolveMarket(req.params.market_id))); }
  catch (e) { next(e); }
});

export default router;