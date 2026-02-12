import { IndexerGrpcSpotApi, IndexerGrpcDerivativesApi } from "@injectivelabs/sdk-ts";
import { getNetworkEndpoints } from "@injectivelabs/networks";
import { config } from "./index";

/* ================================================================== */
/*  Types                                                             */
/* ================================================================== */
export interface MarketMeta {
  marketId: string;
  ticker: string;
  type: "spot" | "derivative";
  baseSymbol: string;
  quoteSymbol: string;
  baseDecimals: number;
  quoteDecimals: number;
}

/* ================================================================== */
/*  Helper: safely extract decimals                                   */
/* ================================================================== */
function safeDecimals(tokenMeta: unknown, fallback: number): number {
  if (
    tokenMeta &&
    typeof tokenMeta === "object" &&
    "decimals" in tokenMeta &&
    typeof (tokenMeta as any).decimals === "number"
  ) {
    return (tokenMeta as any).decimals;
  }
  return fallback;
}

/* ================================================================== */
/*  Market Registry                                                   */
/* ================================================================== */
class MarketRegistry {
  private markets: MarketMeta[] = [];
  private byId: Map<string, MarketMeta> = new Map();
  private initialized = false;

  private rebuildIndex(): void {
    this.byId = new Map(this.markets.map((m) => [m.marketId, m]));
  }

  getAll(): MarketMeta[] { return this.markets; }
  getById(id: string): MarketMeta | undefined { return this.byId.get(id); }
  getByType(type: "spot" | "derivative"): MarketMeta[] { return this.markets.filter((m) => m.type === type); }
  count(): number { return this.markets.length; }

  /**
   * Fetch ALL markets directly from Injective Indexer.
   * No hardcoded IDs — everything comes from the chain.
   */
  async discoverMarkets(): Promise<void> {
    if (this.initialized) return;

    console.log("[MarketRegistry] Fetching all markets from Injective Indexer...");

    const endpoints = getNetworkEndpoints(config.network);
    const spotApi = new IndexerGrpcSpotApi(endpoints.indexer);
    const derivApi = new IndexerGrpcDerivativesApi(endpoints.indexer);

    try {
      /* ---- Fetch ALL spot markets from chain ---- */
      const spotMarkets = await spotApi.fetchMarkets();

      for (const raw of spotMarkets) {
        const r = raw as any;
        const id: string = r.marketId;
        if (!id) continue;

        // Only include active markets with a valid ticker
        const ticker: string = r.ticker || "";
        if (!ticker) continue;

        const parts = ticker.split("/");
        const baseSymbol = (parts[0] || "UNKNOWN").trim();
        const quoteSymbol = (parts[1] || "UNKNOWN").trim();

        this.markets.push({
          marketId: id,
          ticker,
          type: "spot",
          baseSymbol,
          quoteSymbol,
          baseDecimals: safeDecimals(r.baseTokenMeta, 18),
          quoteDecimals: safeDecimals(r.quoteTokenMeta, 6),
        });
      }

      /* ---- Fetch ALL derivative markets from chain ---- */
      const derivMarkets = await derivApi.fetchMarkets();

      for (const raw of derivMarkets) {
        const r = raw as any;
        const id: string = r.marketId;
        if (!id) continue;

        const ticker: string = r.ticker || "";
        if (!ticker) continue;

        const parts = ticker.split("/");
        const baseSymbol = (parts[0] || "UNKNOWN").trim();
        const quotePart = (parts[1] || "USDT PERP").trim();
        const quoteSymbol = quotePart.replace(/\s*PERP\s*/i, "").trim() || "USDT";

        this.markets.push({
          marketId: id,
          ticker,
          type: "derivative",
          baseSymbol,
          quoteSymbol,
          baseDecimals: 18,
          quoteDecimals: safeDecimals(r.quoteTokenMeta, 6),
        });
      }

      this.rebuildIndex();
      this.initialized = true;

      console.log(
        `[MarketRegistry] Loaded ${this.markets.length} markets from chain ` +
        `(${this.getByType("spot").length} spot, ${this.getByType("derivative").length} derivatives)`
      );

    } catch (err) {
      console.error("[MarketRegistry] Failed to fetch from Indexer:", (err as Error).message);
      console.log("[MarketRegistry] Loading emergency fallback markets...");
      this.loadFallback();
    }
  }

  /**
   * Emergency fallback — ONLY used if Indexer is completely unreachable.
   * These IDs need to be verified against the Injective Explorer:
   * https://explorer.injective.network/ → Markets tab
   */
  private loadFallback(): void {
    // NOTE: Verify these IDs at https://explorer.injective.network/markets/
    // They may be outdated. The API will still work if they're wrong —
    // it will just return empty data for those markets.
    this.markets = [
      {
        marketId: "0x0611780ba69656949525013d947713300f56c37b6175e02f26bffa495c3208fe",
        ticker: "INJ/USDT",
        type: "spot",
        baseSymbol: "INJ",
        quoteSymbol: "USDT",
        baseDecimals: 18,
        quoteDecimals: 6,
      },
      {
        marketId: "0x01edfab47f124748dc89998eb33144af734484ba07099014594321729a0ca16b",
        ticker: "ATOM/USDT",
        type: "spot",
        baseSymbol: "ATOM",
        quoteSymbol: "USDT",
        baseDecimals: 6,
        quoteDecimals: 6,
      },
      {
        marketId: "0x9b9980167ecc3645ff1a5517886571571f975c8046724c5e65a5c5fee5249c55",
        ticker: "INJ/USDT PERP",
        type: "derivative",
        baseSymbol: "INJ",
        quoteSymbol: "USDT",
        baseDecimals: 18,
        quoteDecimals: 6,
      },
      {
        marketId: "0x4ca0f92fc28be0c9761f1ac73571a56eb0d8f804b5e17ee4f57600e8e82b7341",
        ticker: "BTC/USDT PERP",
        type: "derivative",
        baseSymbol: "BTC",
        quoteSymbol: "USDT",
        baseDecimals: 18,
        quoteDecimals: 6,
      },
      {
        marketId: "0x54d4505adef6a5cef26bc403588141b6d68650c0ad05883a68c8edf4b1702830",
        ticker: "ETH/USDT PERP",
        type: "derivative",
        baseSymbol: "ETH",
        quoteSymbol: "USDT",
        baseDecimals: 18,
        quoteDecimals: 6,
      },
    ];
    this.rebuildIndex();
    this.initialized = true;
    console.log(`[MarketRegistry] Fallback loaded: ${this.markets.length} markets`);
  }

  resolve(input: string): MarketMeta | undefined {
    const byId = this.byId.get(input);
    if (byId) return byId;

    const norm = input.toUpperCase().replace(/[-_]/g, "/");
    const byTicker = this.markets.find(
      (m) =>
        m.ticker.toUpperCase() === norm ||
        m.ticker.toUpperCase().replace(/\s/g, "") === norm.replace(/\s/g, "")
    );
    if (byTicker) return byTicker;

    const upper = input.toUpperCase();
    const spotMatch = this.markets.find(
      (m) => m.baseSymbol.toUpperCase() === upper && m.type === "spot"
    );
    if (spotMatch) return spotMatch;

    return this.markets.find((m) => m.baseSymbol.toUpperCase() === upper);
  }

  search(query: string): MarketMeta[] {
    const q = query.toUpperCase();
    return this.markets.filter(
      (m) =>
        m.ticker.toUpperCase().includes(q) ||
        m.baseSymbol.toUpperCase().includes(q) ||
        m.quoteSymbol.toUpperCase().includes(q)
    );
  }

  stats(): { total: number; spot: number; derivative: number; discovered: boolean } {
    return {
      total: this.markets.length,
      spot: this.markets.filter((m) => m.type === "spot").length,
      derivative: this.markets.filter((m) => m.type === "derivative").length,
      discovered: this.initialized,
    };
  }
}

export const marketRegistry = new MarketRegistry();