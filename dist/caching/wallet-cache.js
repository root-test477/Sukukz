"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletCache = exports.Cache = void 0;
const error_handler_1 = require("../error-handler");
/**
 * Generic in-memory cache with TTL
 */
class Cache {
    /**
     * Create a new cache instance
     * @param config Cache configuration
     */
    constructor(config) {
        this.cache = new Map();
        this.cleanupInterval = null;
        this.config = Object.assign({ defaultTTL: 5 * 60 * 1000, checkInterval: 60 * 1000, maxSize: 1000 }, config);
        // Start the cleanup interval
        this.startCleanup();
    }
    /**
     * Set a value in the cache
     * @param key Cache key
     * @param value Value to cache
     * @param ttl Optional custom TTL in milliseconds
     */
    set(key, value, ttl) {
        const expiresAt = Date.now() + (ttl || this.config.defaultTTL);
        // Check if cache is at max size and this is a new entry
        if (!this.cache.has(key) && this.cache.size >= this.config.maxSize) {
            this.removeOldest();
        }
        this.cache.set(key, { data: value, expiresAt });
    }
    /**
     * Get a value from the cache
     * @param key Cache key
     * @returns The cached value or undefined if not found or expired
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return undefined;
        }
        // Check if entry is expired
        if (entry.expiresAt < Date.now()) {
            this.cache.delete(key);
            return undefined;
        }
        return entry.data;
    }
    /**
     * Check if a key exists in the cache and is not expired
     * @param key Cache key
     * @returns True if key exists and is not expired
     */
    has(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }
        // Check if entry is expired
        if (entry.expiresAt < Date.now()) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    /**
     * Delete a key from the cache
     * @param key Cache key
     */
    delete(key) {
        this.cache.delete(key);
    }
    /**
     * Clear the entire cache
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Get the number of entries in the cache
     */
    size() {
        return this.cache.size;
    }
    /**
     * Start the cleanup interval
     */
    startCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, this.config.checkInterval);
    }
    /**
     * Stop the cleanup interval
     */
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    /**
     * Clean up expired entries
     */
    cleanup() {
        try {
            const now = Date.now();
            const keysToDelete = [];
            this.cache.forEach((entry, key) => {
                if (entry.expiresAt < now) {
                    keysToDelete.push(key);
                }
            });
            keysToDelete.forEach(key => {
                this.cache.delete(key);
            });
            if (keysToDelete.length > 0) {
                console.log(`Cache cleanup: Removed ${keysToDelete.length} expired entries`);
            }
        }
        catch (error) {
            error_handler_1.ErrorHandler.handleError({
                type: error_handler_1.ErrorType.GENERAL,
                message: `Error during cache cleanup: ${error instanceof Error ? error.message : String(error)}`,
                timestamp: Date.now(),
                stack: error instanceof Error ? error.stack : undefined
            });
        }
    }
    /**
     * Remove the oldest entry if the cache is full
     */
    removeOldest() {
        // Find the entry with the earliest expiration
        let oldestKey;
        let oldestTime = Infinity;
        this.cache.forEach((entry, key) => {
            if (entry.expiresAt < oldestTime) {
                oldestTime = entry.expiresAt;
                oldestKey = key;
            }
        });
        // Remove the oldest entry
        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }
}
exports.Cache = Cache;
/**
 * Wallet data cache
 */
class WalletCache {
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!WalletCache.instance) {
            WalletCache.instance = new WalletCache();
        }
        return WalletCache.instance;
    }
    /**
     * Private constructor
     */
    constructor() {
        // Create caches with different TTLs
        this.walletInfoCache = new Cache({
            defaultTTL: 30 * 60 * 1000,
            checkInterval: 5 * 60 * 1000, // 5 minutes cleanup
        });
        this.walletBalanceCache = new Cache({
            defaultTTL: 2 * 60 * 1000,
            checkInterval: 1 * 60 * 1000, // 1 minute cleanup
        });
    }
    /**
     * Get wallet info from cache
     * @param walletAppName Wallet app name
     */
    getWalletInfo(walletAppName) {
        return this.walletInfoCache.get(`wallet_info:${walletAppName}`);
    }
    /**
     * Set wallet info in cache
     * @param walletAppName Wallet app name
     * @param walletInfo Wallet info object
     */
    setWalletInfo(walletAppName, walletInfo) {
        this.walletInfoCache.set(`wallet_info:${walletAppName}`, walletInfo);
    }
    /**
     * Get wallet balance from cache
     * @param address Wallet address
     */
    getWalletBalance(address) {
        return this.walletBalanceCache.get(`wallet_balance:${address}`);
    }
    /**
     * Set wallet balance in cache
     * @param address Wallet address
     * @param balance Balance object
     */
    setWalletBalance(address, balance) {
        this.walletBalanceCache.set(`wallet_balance:${address}`, balance);
    }
    /**
     * Clear all wallet caches
     */
    clearAll() {
        this.walletInfoCache.clear();
        this.walletBalanceCache.clear();
    }
}
exports.WalletCache = WalletCache;
//# sourceMappingURL=wallet-cache.js.map