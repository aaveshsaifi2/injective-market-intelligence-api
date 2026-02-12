import { Router } from "express";
import { resolveMarket, BadRequestError } from "../middleware/error";
import { liquidityService } from "../services/liquidity.service";

const router = Router();

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