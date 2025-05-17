import { WalletInfoRemote } from '@tonconnect/sdk';
export declare function getWallets(): Promise<WalletInfoRemote[]>;
export declare function getWalletInfo(walletAppName: string): Promise<WalletInfoRemote | undefined>;
/**
 * Get the balance of a wallet address in TON
 * @param walletAddress The wallet address to check
 * @returns The wallet balance in TON as a string with 2 decimal places
 */
export declare function getWalletBalance(walletAddress: string): Promise<string>;
