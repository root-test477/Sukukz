import { isWalletInfoRemote, WalletInfoRemote, WalletsListManager } from '@tonconnect/sdk';

const walletsListManager = new WalletsListManager({
    cacheTTLMs: Number(process.env.WALLETS_LIST_CACHE_TTL_MS)
});

export async function getWallets(): Promise<WalletInfoRemote[]> {
    const wallets = await walletsListManager.getWallets();
    return wallets.filter(isWalletInfoRemote);
}

export async function getWalletInfo(walletAppName: string): Promise<WalletInfoRemote | undefined> {
    const wallets = await getWallets();
    return wallets.find(wallet => wallet.appName.toLowerCase() === walletAppName.toLowerCase());
}

/**
 * Get the balance of a wallet address in TON
 * @param walletAddress The wallet address to check
 * @returns The wallet balance in TON as a string with 2 decimal places
 */
export async function getWalletBalance(walletAddress: string): Promise<string> {
    try {
        // For demo purposes, we're just returning a random balance
        // In a real application, you would call the TON API to get the actual balance
        const randomBalance = (Math.random() * 100).toFixed(2);
        return randomBalance;
    } catch (error) {
        console.error(`Error getting wallet balance for ${walletAddress}:`, error);
        return '0.00';
    }
}
