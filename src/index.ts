import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

import { config } from "./config";
import { marketRegistry } from "./config/markets";
import { errorHandler } from "./middleware/error";

import healthRoutes from "./routes/health.routes";
import marketsRoutes from "./routes/markets.routes";
import liquidityRoutes from "./routes/liquidity.routes";
import volatilityRoutes from "./routes/volatility.routes";
import microstructureRoutes from "./routes/microstructure.routes";
import rankingsRoutes from "./routes/rankings.routes";

const app = express();

/* ---- Global Middleware ---- */
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests" } },
}));

/* ---- Swagger Docs ---- */
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Injective Market Intelligence API",
      version: "1.0.0",
      description: "Computed-data API transforming raw Injective orderbook/trade data into actionable intelligence scores.",
      contact: { name: "SAIFID3X" },
      license: { name: "MIT" },
    },
    servers: [{ url: `http://localhost:${config.port}`, description: "Local" }],
  },
  apis: [],
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: "IMI-API Docs" }));

/* ---- Routes ---- */
app.use("/v1/health", healthRoutes);
app.use("/v1/markets", marketsRoutes);
app.use("/v1/liquidity", liquidityRoutes);
app.use("/v1/volatility", volatilityRoutes);
app.use("/v1/microstructure", microstructureRoutes);
app.use("/v1/rankings", rankingsRoutes);
app.use("/v1", rankingsRoutes);

/* ---- Root ---- */
app.get("/", (_req, res) => {
  res.json({
    name: "Injective Market Intelligence API",
    version: "1.0.0",
    docs: "/docs",
    health: "/v1/health",
    markets: "/v1/markets",
    endpoints: {
      liquidity_score: "GET /v1/liquidity/{market_id}/score",
      liquidity_depth: "GET /v1/liquidity/{market_id}/depth",
      liquidity_slippage: "GET /v1/liquidity/{market_id}/slippage?size=10000&side=buy",
      liquidity_spread: "GET /v1/liquidity/{market_id}/spread",
      volatility_current: "GET /v1/volatility/{market_id}/current",
      volatility_regime: "GET /v1/volatility/{market_id}/regime",
      volatility_history: "GET /v1/volatility/{market_id}/history?period=7d",
      microstructure_flow: "GET /v1/microstructure/{market_id}/flow",
      microstructure_whales: "GET /v1/microstructure/{market_id}/whales?hours=24",
      microstructure_momentum: "GET /v1/microstructure/{market_id}/momentum",
      rankings_liquidity: "GET /v1/rankings/liquidity?type=spot",
      rankings_volatility: "GET /v1/rankings/volatility?type=derivative",
      compare: "GET /v1/compare?markets=INJ/USDT,BTC/USDT PERP",
    },
  });
});

/* ---- Error handler (LAST) ---- */
app.use(errorHandler as any);

/* ---- Boot ---- */
async function boot() {
  // Discover markets from on-chain before accepting requests
  await marketRegistry.discoverMarkets();

  app.listen(config.port, () => {
    const stats = marketRegistry.stats();
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║  🚀 Injective Market Intelligence API                         ║
║                                                                ║
║  Server:    http://localhost:${config.port}                          ║
║  Docs:      http://localhost:${config.port}/docs                     ║
║  Health:    http://localhost:${config.port}/v1/health                ║
║  Network:   ${String(config.network).padEnd(47)}║
║  Markets:   ${String(stats.total).padEnd(4)} (${stats.spot} spot + ${String(stats.derivative).padEnd(2)} derivatives)${" ".repeat(21)}║
╚════════════════════════════════════════════════════════════════╝
    `);
  });
}

boot().catch(console.error);

export default app;