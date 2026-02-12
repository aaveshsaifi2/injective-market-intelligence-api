import { IndexerGrpcSpotApi, IndexerGrpcDerivativesApi } from "@injectivelabs/sdk-ts";
import { getNetworkEndpoints } from "@injectivelabs/networks";
import { config } from "../config";
import { MarketMeta } from "../config/markets";
import { cacheService } from "./cache.service";

export interface OrderbookLevel { price: number; quantity: number; timestamp: number; }
export interface OrderbookData { buys: OrderbookLevel[]; sells: OrderbookLevel[]; fetchedAt: number; }
export interface TradeData {
  price: number; quantity: number; timestamp: number;
  executionSide: "maker" | "taker"; tradeDirection: "buy" | "sell";
}
export interface MarketSummaryData {
  price: number; open: number; high: number; low: number; volume: number; change: number;
}

class InjectiveService {
  private spotApi: IndexerGrpcSpotApi;
  private derivApi: IndexerGrpcDerivativesApi;

  constructor() {
    const ep = getNetworkEndpoints(config.network);
    this.spotApi = new IndexerGrpcSpotApi(ep.indexer);
    this.derivApi = new IndexerGrpcDerivativesApi(ep.indexer);
  }

  getNetworkName(): string { return config.network.toString(); }

  async fetchOrderbook(market: MarketMeta): Promise<OrderbookData> {
    return cacheService.getOrCompute(`ob:${market.marketId}`, async () => {
      try {
        const raw = market.type === "spot"
          ? await this.spotApi.fetchOrderbookV2(market.marketId)
          : await this.derivApi.fetchOrderbookV2(market.marketId);

        const parse = (levels: any[]): OrderbookLevel[] =>
          (levels || []).map((l: any) => ({
            price: parseFloat(l.price || "0"),
            quantity: parseFloat(l.quantity || "0"),
            timestamp: parseInt(l.timestamp || "0", 10),
          }));

        return { buys: parse(raw.buys), sells: parse(raw.sells), fetchedAt: Date.now() };
      } catch (e) {
        console.error(`[Injective] orderbook ${market.ticker}:`, (e as Error).message);
        return { buys: [], sells: [], fetchedAt: Date.now() };
      }
    }, config.cache.orderbookTtl);
  }

  async fetchTrades(market: MarketMeta, limit = 100): Promise<TradeData[]> {
    return cacheService.getOrCompute(`tr:${market.marketId}:${limit}`, async () => {
      try {
        const raw = market.type === "spot"
          ? await this.spotApi.fetchTrades({ marketIds: [market.marketId], pagination: { limit } })
          : await this.derivApi.fetchTrades({ marketIds: [market.marketId], pagination: { limit } });

        return (raw.trades || []).map((t: any) => ({
          price: parseFloat(t.price?.price || t.executionPrice || "0"),
          quantity: parseFloat(t.price?.quantity || t.executionQuantity || "0"),
          timestamp: parseInt(t.executedAt || "0", 10),
          executionSide: (t.executionSide === "taker" ? "taker" : "maker") as "maker" | "taker",
          tradeDirection: (t.tradeDirection === "sell" ? "sell" : "buy") as "buy" | "sell",
        }));
      } catch (e) {
        console.error(`[Injective] trades ${market.ticker}:`, (e as Error).message);
        return [];
      }
    }, config.cache.tradesTtl);
  }

  async fetchMarketSummary(market: MarketMeta): Promise<MarketSummaryData> {
    return cacheService.getOrCompute(`sum:${market.marketId}`, async () => {
      try {
        const trades = await this.fetchTrades(market, 200);
        if (trades.length === 0) return { price: 0, open: 0, high: 0, low: 0, volume: 0, change: 0 };

        const prices = trades.map((t) => t.price).filter((p) => p > 0);
        const price = prices[0] || 0;
        const open = prices[prices.length - 1] || price;
        const high = Math.max(...prices);
        const low = Math.min(...prices);
        const volume = trades.reduce((s, t) => s + t.price * t.quantity, 0);
        const change = open > 0 ? ((price - open) / open) * 100 : 0;

        return { price, open, high, low, volume, change };
      } catch (e) {
        console.error(`[Injective] summary ${market.ticker}:`, (e as Error).message);
        return { price: 0, open: 0, high: 0, low: 0, volume: 0, change: 0 };
      }
    }, config.cache.computedTtl);
  }
}

export const injectiveService = new InjectiveService();