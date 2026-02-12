import { Router } from "express";
import { resolveMarket } from "../middleware/error";
import { microstructureService } from "../services/microstructure.service";

const router = Router();

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