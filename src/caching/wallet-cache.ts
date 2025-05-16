import { ErrorHandler, ErrorType } from '../error-handler';

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

/**
 * Cache configuration
 */
interface CacheConfig {
    defaultTTL: number; // Time to live in milliseconds
    checkInterval: number; // Cleanup interval in milliseconds
    maxSize: number; // Maximum number of entries
}

/**
 * Generic in-memory cache with TTL
 */
export class Cache<T> {
    private cache: Map<string, CacheEntry<T>> = new Map();
    private config: CacheConfig;
    private cleanupInterval: NodeJS.Timeout | null = null;
    
    /**
     * Create a new cache instance
     * @param config Cache configuration
     */
    constructor(config?: Partial<CacheConfig>) {
        this.config = {
            defaultTTL: 5 * 60 * 1000, // 5 minutes default
            checkInterval: 60 * 1000, // 1 minute cleanup
            maxSize: 1000, // Max 1000 entries
            ...config
        };
        
        // Start the cleanup interval
        this.startCleanup();
    }
    
    /**
     * Set a value in the cache
     * @param key Cache key
     * @param value Value to cache
     * @param ttl Optional custom TTL in milliseconds
     */
    set(key: string, value: T, ttl?: number): void {
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
    get(key: string): T | undefined {
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
    has(key: string): boolean {
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
    delete(key: string): void {
        this.cache.delete(key);
    }
    
    /**
     * Clear the entire cache
     */
    clear(): void {
        this.cache.clear();
    }
    
    /**
     * Get the number of entries in the cache
     */
    size(): number {
        return this.cache.size;
    }
    
    /**
     * Start the cleanup interval
     */
    private startCleanup(): void {
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
    stopCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    
    /**
     * Clean up expired entries
     */
    private cleanup(): void {
        try {
            const now = Date.now();
            const keysToDelete: string[] = [];
            
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
        } catch (error) {
            ErrorHandler.handleError({
                type: ErrorType.GENERAL,
                message: `Error during cache cleanup: ${error instanceof Error ? error.message : String(error)}`,
                timestamp: Date.now(),
                stack: error instanceof Error ? error.stack : undefined
            });
        }
    }
    
    /**
     * Remove the oldest entry if the cache is full
     */
    private removeOldest(): void {
        // Find the entry with the earliest expiration
        let oldestKey: string | undefined;
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

/**
 * Wallet data cache
 */
export class WalletCache {
    private static instance: WalletCache;
    private walletInfoCache: Cache<any>;
    private walletBalanceCache: Cache<any>;
    
    /**
     * Get the singleton instance
     */
    public static getInstance(): WalletCache {
        if (!WalletCache.instance) {
            WalletCache.instance = new WalletCache();
        }
        return WalletCache.instance;
    }
    
    /**
     * Private constructor
     */
    private constructor() {
        // Create caches with different TTLs
        this.walletInfoCache = new Cache({
            defaultTTL: 30 * 60 * 1000, // 30 minutes for wallet info (rarely changes)
            checkInterval: 5 * 60 * 1000, // 5 minutes cleanup
        });
        
        this.walletBalanceCache = new Cache({
            defaultTTL: 2 * 60 * 1000, // 2 minutes for wallet balances (changes more frequently)
            checkInterval: 1 * 60 * 1000, // 1 minute cleanup
        });
    }
    
    /**
     * Get wallet info from cache
     * @param walletAppName Wallet app name
     */
    getWalletInfo(walletAppName: string): any | undefined {
        return this.walletInfoCache.get(`wallet_info:${walletAppName}`);
    }
    
    /**
     * Set wallet info in cache
     * @param walletAppName Wallet app name
     * @param walletInfo Wallet info object
     */
    setWalletInfo(walletAppName: string, walletInfo: any): void {
        this.walletInfoCache.set(`wallet_info:${walletAppName}`, walletInfo);
    }
    
    /**
     * Get wallet balance from cache
     * @param address Wallet address
     */
    getWalletBalance(address: string): any | undefined {
        return this.walletBalanceCache.get(`wallet_balance:${address}`);
    }
    
    /**
     * Set wallet balance in cache
     * @param address Wallet address
     * @param balance Balance object
     */
    setWalletBalance(address: string, balance: any): void {
        this.walletBalanceCache.set(`wallet_balance:${address}`, balance);
    }
    
    /**
     * Clear all wallet caches
     */
    clearAll(): void {
        this.walletInfoCache.clear();
        this.walletBalanceCache.clear();
    }
}
