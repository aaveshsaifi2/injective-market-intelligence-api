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
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(morgan("dev"));
app.use(express.json());

app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: { code: "RATE_LIMITED", message: "Too many requests" },
    },
  })
);

/* ---- Swagger Docs ---- */
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Injective Market Intelligence API",
      version: "1.0.0",
      description:
        "Computed-data API transforming raw Injective orderbook/trade data into actionable intelligence scores.",
      contact: { name: "SAIFID3X" },
      license: { name: "MIT" },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: "Local development server",
      },
    ],
    tags: [
      { name: "System", description: "Health & system endpoints" },
      { name: "Markets", description: "Market discovery & summaries" },
      { name: "Liquidity", description: "Liquidity analytics endpoints" },
      { name: "Volatility", description: "Volatility analytics endpoints" },
      { name: "Microstructure", description: "Order flow & whale analytics" },
      { name: "Rankings", description: "Market ranking & comparison endpoints" },
    ],
  },

  // 🔥 THIS IS THE IMPORTANT STEP 2 FIX
  apis: ["./src/routes/*.ts"],
});

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "IMI-API Docs",
  })
);

/* ---- Routes ---- */
app.use("/v1/health", healthRoutes);
app.use("/v1/markets", marketsRoutes);
app.use("/v1/liquidity", liquidityRoutes);
app.use("/v1/volatility", volatilityRoutes);
app.use("/v1/microstructure", microstructureRoutes);
app.use("/v1/rankings", rankingsRoutes);

/* ---- Root ---- */
app.get("/", (_req, res) => {
  res.json({
    name: "Injective Market Intelligence API",
    version: "1.0.0",
    docs: "/docs",
    health: "/v1/health",
    markets: "/v1/markets",
  });
});

/* ---- Error handler (LAST) ---- */
app.use(errorHandler as any);

/* ---- Boot ---- */
async function boot() {
  await marketRegistry.discoverMarkets();

  app.listen(config.port, () => {
    const stats = marketRegistry.stats();

    console.log(`
╔════════════════════════════════════════════════════════════════╗
║  🚀 Injective Market Intelligence API                         ║
║                                                                ║
║  Server:    http://localhost:${config.port}
║  Docs:      http://localhost:${config.port}/docs
║  Health:    http://localhost:${config.port}/v1/health
║  Network:   ${String(config.network)}
║  Markets:   ${stats.total} (${stats.spot} spot + ${stats.derivative} derivatives)
╚════════════════════════════════════════════════════════════════╝
    `);
  });
}

boot().catch(console.error);

export default app;
