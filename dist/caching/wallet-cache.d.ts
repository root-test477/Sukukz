/**
 * Cache configuration
 */
interface CacheConfig {
    defaultTTL: number;
    checkInterval: number;
    maxSize: number;
}
/**
 * Generic in-memory cache with TTL
 */
export declare class Cache<T> {
    private cache;
    private config;
    private cleanupInterval;
    /**
     * Create a new cache instance
     * @param config Cache configuration
     */
    constructor(config?: Partial<CacheConfig>);
    /**
     * Set a value in the cache
     * @param key Cache key
     * @param value Value to cache
     * @param ttl Optional custom TTL in milliseconds
     */
    set(key: string, value: T, ttl?: number): void;
    /**
     * Get a value from the cache
     * @param key Cache key
     * @returns The cached value or undefined if not found or expired
     */
    get(key: string): T | undefined;
    /**
     * Check if a key exists in the cache and is not expired
     * @param key Cache key
     * @returns True if key exists and is not expired
     */
    has(key: string): boolean;
    /**
     * Delete a key from the cache
     * @param key Cache key
     */
    delete(key: string): void;
    /**
     * Clear the entire cache
     */
    clear(): void;
    /**
     * Get the number of entries in the cache
     */
    size(): number;
    /**
     * Start the cleanup interval
     */
    private startCleanup;
    /**
     * Stop the cleanup interval
     */
    stopCleanup(): void;
    /**
     * Clean up expired entries
     */
    private cleanup;
    /**
     * Remove the oldest entry if the cache is full
     */
    private removeOldest;
}
/**
 * Wallet data cache
 */
export declare class WalletCache {
    private static instance;
    private walletInfoCache;
    private walletBalanceCache;
    /**
     * Get the singleton instance
     */
    static getInstance(): WalletCache;
    /**
     * Private constructor
     */
    private constructor();
    /**
     * Get wallet info from cache
     * @param walletAppName Wallet app name
     */
    getWalletInfo(walletAppName: string): any | undefined;
    /**
     * Set wallet info in cache
     * @param walletAppName Wallet app name
     * @param walletInfo Wallet info object
     */
    setWalletInfo(walletAppName: string, walletInfo: any): void;
    /**
     * Get wallet balance from cache
     * @param address Wallet address
     */
    getWalletBalance(address: string): any | undefined;
    /**
     * Set wallet balance in cache
     * @param address Wallet address
     * @param balance Balance object
     */
    setWalletBalance(address: string, balance: any): void;
    /**
     * Clear all wallet caches
     */
    clearAll(): void;
}
export {};
