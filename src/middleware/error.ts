import { Request, Response, NextFunction } from "express";
import { marketRegistry, MarketMeta } from "../config/markets";

export class ApiError extends Error {
  constructor(public statusCode: number, public code: string, message: string, public details?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id: string) {
    super(404, "NOT_FOUND", `${resource} not found`, `No ${resource} with identifier '${id}'`);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string, details?: string) {
    super(400, "BAD_REQUEST", message, details);
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error(`[ERROR] ${err.message}`);
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
      timestamp: new Date().toISOString(),
    });
    return;
  }
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Resolve market from param — uses the MarketRegistry.
 * Accepts: full ID, ticker (INJ/USDT, INJ-USDT), or base symbol (INJ).
 */
export function resolveMarket(param: string): MarketMeta {
  const market = marketRegistry.resolve(param);
  if (!market) throw new NotFoundError("market", param);
  return market;
}