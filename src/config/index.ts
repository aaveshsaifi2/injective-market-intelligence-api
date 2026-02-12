import dotenv from "dotenv";
import { Network } from "@injectivelabs/networks";

dotenv.config();

const envStr = (k: string, d: string) => process.env[k] ?? d;
const envInt = (k: string, d: number) => {
  const v = process.env[k];
  return v ? parseInt(v, 10) : d;
};

function resolveNetwork(name: string): Network {
  const m: Record<string, Network> = {
    mainnet: Network.Mainnet,
    testnet: Network.Testnet,
    devnet: Network.Devnet,
  };
  return m[name.toLowerCase()] ?? Network.Mainnet;
}

export const config = Object.freeze({
  port: envInt("PORT", 3000),
  nodeEnv: envStr("NODE_ENV", "development"),
  network: resolveNetwork(envStr("NETWORK", "Mainnet")),
  cache: {
    orderbookTtl: envInt("CACHE_TTL_ORDERBOOK", 10),
    tradesTtl: envInt("CACHE_TTL_TRADES", 15),
    marketsTtl: envInt("CACHE_TTL_MARKETS", 300),
    computedTtl: envInt("CACHE_TTL_COMPUTED", 30),
  },
  rateLimit: {
    windowMs: envInt("RATE_LIMIT_WINDOW_MS", 60_000),
    maxRequests: envInt("RATE_LIMIT_MAX_REQUESTS", 100),
  },
});