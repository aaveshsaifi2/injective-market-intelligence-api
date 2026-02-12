import { Router } from "express";
import { resolveMarket } from "../middleware/error";
import { volatilityService } from "../services/volatility.service";

const router = Router();

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