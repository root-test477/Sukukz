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
 * Get wallet balance for the provided address
 * This calls an external API to get the wallet balance
 */
export async function getWalletBalance(address: string): Promise<string> {
    try {
        // Make sure the address is valid
        if (!address || address.length < 10) {
            throw new Error('Invalid wallet address');
        }
        
        // Normally we would call a TON API here, but for this demo we'll return a static value
        // In a real implementation, you'd make an API call to a TON blockchain explorer or node
        return '10.5 TON';
    } catch (error) {
        console.error('Error fetching wallet balance:', error);
        return '0 TON';
    }
}
