import NodeCache from "node-cache";
import { config } from "../config";

class CacheService {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({ stdTTL: config.cache.computedTtl, checkperiod: 60, useClones: false });
  }

  get<T>(key: string): T | undefined { return this.cache.get<T>(key); }

  set<T>(key: string, value: T, ttl?: number): void {
    ttl !== undefined ? this.cache.set(key, value, ttl) : this.cache.set(key, value);
  }

  async getOrCompute<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await fn();
    this.set(key, value, ttl);
    return value;
  }

  invalidate(key: string): void { this.cache.del(key); }
  flush(): void { this.cache.flushAll(); }
  stats() { return this.cache.getStats(); }
}

export const cacheService = new CacheService();