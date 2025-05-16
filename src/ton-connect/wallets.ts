import { WalletInfoRemote } from '@tonconnect/sdk';
import { getCachedWalletInfo, getCachedWallets, invalidateWalletsCache } from '../wallet-cache';

// Cached version exposed to the rest of the app
export async function getWallets(): Promise<WalletInfoRemote[]> {
    return getCachedWallets();
}

// Cached version exposed to the rest of the app
export async function getWalletInfo(walletAppName: string): Promise<WalletInfoRemote | undefined> {
    return getCachedWalletInfo(walletAppName);
}

// Used to refresh the wallets list if needed
export function refreshWalletsList(): void {
    invalidateWalletsCache();
}
