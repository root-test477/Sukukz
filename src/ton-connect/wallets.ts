import { isWalletInfoRemote, WalletInfoRemote, WalletsListManager } from '@tonconnect/sdk';
import { WalletCache } from '../caching/wallet-cache';
import { ErrorHandler, ErrorType } from '../error-handler';

const walletsListManager = new WalletsListManager({
    cacheTTLMs: Number(process.env.WALLETS_LIST_CACHE_TTL_MS)
});

const walletCache = WalletCache.getInstance();

/**
 * Get all available wallets
 * Implements caching to reduce API calls
 */
export async function getWallets(): Promise<WalletInfoRemote[]> {
    try {
        // Check if we have wallets in cache
        const cachedWallets = walletCache.getWalletInfo('all_wallets');
        if (cachedWallets) {
            return cachedWallets;
        }
        
        // If not cached, fetch from API
        const wallets = await walletsListManager.getWallets();
        const filteredWallets = wallets.filter(isWalletInfoRemote);
        
        // Cache the result
        walletCache.setWalletInfo('all_wallets', filteredWallets);
        
        return filteredWallets;
    } catch (error) {
        ErrorHandler.handleError({
            type: ErrorType.WALLET_CONNECTION,
            message: `Error fetching wallets: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: Date.now(),
            stack: error instanceof Error ? error.stack : undefined
        });
        // Return empty array on error
        return [];
    }
}

/**
 * Get information about a specific wallet
 * Uses caching to improve performance
 * @param walletAppName The wallet app name
 */
export async function getWalletInfo(walletAppName: string): Promise<WalletInfoRemote | undefined> {
    try {
        if (!walletAppName) return undefined;
        
        // Normalize wallet app name for caching
        const normalizedName = walletAppName.toLowerCase();
        
        // Check if we have this wallet info in cache
        const cachedInfo = walletCache.getWalletInfo(normalizedName);
        if (cachedInfo) {
            return cachedInfo;
        }
        
        // If not cached, fetch all wallets and find the one we need
        const wallets = await getWallets();
        const walletInfo = wallets.find(wallet => wallet.appName.toLowerCase() === normalizedName);
        
        if (walletInfo) {
            // Cache the result
            walletCache.setWalletInfo(normalizedName, walletInfo);
        }
        
        return walletInfo;
    } catch (error) {
        ErrorHandler.handleError({
            type: ErrorType.WALLET_CONNECTION,
            message: `Error fetching wallet info for ${walletAppName}: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: Date.now(),
            stack: error instanceof Error ? error.stack : undefined
        });
        return undefined;
    }
}

/**
 * Get wallet balance (placeholder - actual implementation would fetch from blockchain)
 * @param address Wallet address
 */
export async function getWalletBalance(address: string): Promise<any | undefined> {
    try {
        if (!address) return undefined;
        
        // Check if we have balance in cache
        const cachedBalance = walletCache.getWalletBalance(address);
        if (cachedBalance) {
            return cachedBalance;
        }
        
        // In a real implementation, this would fetch the balance from a blockchain API
        // For now, we'll return a mock balance
        const mockBalance = {
            balance: Math.floor(Math.random() * 10000) / 100, // Random balance between 0 and 100
            lastUpdated: Date.now()
        };
        
        // Cache the result
        walletCache.setWalletBalance(address, mockBalance);
        
        return mockBalance;
    } catch (error) {
        ErrorHandler.handleError({
            type: ErrorType.WALLET_CONNECTION,
            message: `Error fetching wallet balance for ${address}: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: Date.now(),
            stack: error instanceof Error ? error.stack : undefined
        });
        return undefined;
    }
}
