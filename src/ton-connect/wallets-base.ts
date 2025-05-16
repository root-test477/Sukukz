import { WalletInfoRemote, WalletsListManager, isWalletInfoRemote } from '@tonconnect/sdk';

const walletsListManager = new WalletsListManager({
    cacheTTLMs: Number(process.env.WALLETS_LIST_CACHE_TTL_MS)
});

// Base implementation for getting wallet list
export async function getWalletsBase(): Promise<WalletInfoRemote[]> {
    const wallets = await walletsListManager.getWallets();
    return wallets.filter(isWalletInfoRemote);
}

// Base implementation for getting wallet info
export async function getWalletInfoBase(walletAppName: string): Promise<WalletInfoRemote | undefined> {
    const wallets = await getWalletsBase();
    return wallets.find(wallet => wallet.appName.toLowerCase() === walletAppName.toLowerCase());
} 