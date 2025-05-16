import { WalletInfoRemote } from '@tonconnect/sdk';
export declare function getWallets(): Promise<WalletInfoRemote[]>;
export declare function getWalletInfo(walletAppName: string): Promise<WalletInfoRemote | undefined>;
/**
 * Get wallet balance for the provided address
 * This calls an external API to get the wallet balance
 */
export declare function getWalletBalance(address: string): Promise<string>;
