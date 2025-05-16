import { WalletInfoRemote } from '@tonconnect/sdk';
/**
 * Get all available wallets
 * Implements caching to reduce API calls
 */
export declare function getWallets(): Promise<WalletInfoRemote[]>;
/**
 * Get information about a specific wallet
 * Uses caching to improve performance
 * @param walletAppName The wallet app name
 */
export declare function getWalletInfo(walletAppName: string): Promise<WalletInfoRemote | undefined>;
/**
 * Get wallet balance (placeholder - actual implementation would fetch from blockchain)
 * @param address Wallet address
 */
export declare function getWalletBalance(address: string): Promise<any | undefined>;
