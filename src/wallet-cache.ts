import { WalletInfoRemote } from '@tonconnect/sdk';
import TonConnect from '@tonconnect/sdk';
import { getWalletInfo as getOriginalWalletInfo, getWallets as getOriginalWallets } from './ton-connect/wallets';

// Define cache TTL (from env or default to 5 minutes)
const WALLET_CACHE_TTL_MS = Number(process.env.WALLET_CACHE_TTL_MS) || 300000;
const ENABLE_WALLET_CACHE = process.env.ENABLE_WALLET_CACHE === 'true';

// Cache interface
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// Wallet list cache
let walletsCache: CacheEntry<WalletInfoRemote[]> | null = null;

// Wallet info cache
const walletInfoCache = new Map<string, CacheEntry<WalletInfoRemote>>();

// Wallet connection cache
interface WalletConnectionCacheEntry {
  connector: TonConnect;
  address: string;
  appName: string;
  lastUsed: number;
}
const walletConnectionCache = new Map<number, WalletConnectionCacheEntry>();

/**
 * Get wallets list with caching
 */
export async function getCachedWallets(): Promise<WalletInfoRemote[]> {
  if (!ENABLE_WALLET_CACHE) {
    return getOriginalWallets();
  }
  
  const now = Date.now();
  
  // If cache is valid, return cached data
  if (walletsCache && walletsCache.expiresAt > now) {
    console.log('[CACHE] Using cached wallets list');
    return walletsCache.data;
  }
  
  // Otherwise, fetch new data
  console.log('[CACHE] Fetching fresh wallets list');
  const wallets = await getOriginalWallets();
  
  // Update cache
  walletsCache = {
    data: wallets,
    expiresAt: now + WALLET_CACHE_TTL_MS
  };
  
  return wallets;
}

/**
 * Get wallet info with caching
 */
export async function getCachedWalletInfo(appName: string): Promise<WalletInfoRemote | undefined> {
  if (!ENABLE_WALLET_CACHE) {
    return getOriginalWalletInfo(appName);
  }
  
  const now = Date.now();
  const cacheKey = appName.toLowerCase();
  
  // If cache is valid, return cached data
  const cached = walletInfoCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    console.log(`[CACHE] Using cached wallet info for ${appName}`);
    return cached.data;
  }
  
  // Otherwise, fetch new data
  console.log(`[CACHE] Fetching fresh wallet info for ${appName}`);
  const walletInfo = await getOriginalWalletInfo(appName);
  
  // Update cache if wallet info was found
  if (walletInfo) {
    walletInfoCache.set(cacheKey, {
      data: walletInfo,
      expiresAt: now + WALLET_CACHE_TTL_MS
    });
  }
  
  return walletInfo;
}

/**
 * Cache wallet connection for a user
 */
export function cacheWalletConnection(
  chatId: number, 
  connector: TonConnect
): void {
  if (!ENABLE_WALLET_CACHE || !connector.connected || !connector.wallet) {
    return;
  }
  
  walletConnectionCache.set(chatId, {
    connector,
    address: connector.wallet.account.address,
    appName: connector.wallet.device.appName,
    lastUsed: Date.now()
  });
  
  console.log(`[CACHE] Cached wallet connection for user ${chatId}`);
}

/**
 * Get cached wallet connection
 * Returns null if no cached connection or if the wallet is not connected
 */
export function getCachedWalletConnection(
  chatId: number
): TonConnect | null {
  if (!ENABLE_WALLET_CACHE) {
    return null;
  }
  
  const cached = walletConnectionCache.get(chatId);
  if (!cached) {
    return null;
  }
  
  // Update lastUsed timestamp
  cached.lastUsed = Date.now();
  
  // Check if still connected
  if (!cached.connector.connected) {
    walletConnectionCache.delete(chatId);
    return null;
  }
  
  console.log(`[CACHE] Using cached wallet connection for user ${chatId}`);
  return cached.connector;
}

/**
 * Invalidate wallet connection cache for a user
 */
export function invalidateWalletConnectionCache(chatId: number): void {
  if (walletConnectionCache.has(chatId)) {
    walletConnectionCache.delete(chatId);
    console.log(`[CACHE] Invalidated wallet connection cache for user ${chatId}`);
  }
}

/**
 * Invalidate wallet info cache
 */
export function invalidateWalletInfoCache(appName?: string): void {
  if (appName) {
    const cacheKey = appName.toLowerCase();
    if (walletInfoCache.has(cacheKey)) {
      walletInfoCache.delete(cacheKey);
      console.log(`[CACHE] Invalidated wallet info cache for ${appName}`);
    }
  } else {
    walletInfoCache.clear();
    console.log('[CACHE] Invalidated all wallet info cache');
  }
}

/**
 * Invalidate wallets list cache
 */
export function invalidateWalletsCache(): void {
  walletsCache = null;
  console.log('[CACHE] Invalidated wallets list cache');
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  invalidateWalletsCache();
  walletInfoCache.clear();
  walletConnectionCache.clear();
  console.log('[CACHE] Cleared all wallet caches');
}

/**
 * Clean expired connections periodically
 */
export function startCacheCleanupInterval(intervalMs: number = 300000): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    // Clean up expired wallet connections
    walletConnectionCache.forEach((entry, chatId) => {
      if (now - entry.lastUsed > WALLET_CACHE_TTL_MS) {
        walletConnectionCache.delete(chatId);
        cleaned++;
      }
    });
    
    if (cleaned > 0) {
      console.log(`[CACHE] Cleaned up ${cleaned} expired wallet connections`);
    }
  }, intervalMs);
} 