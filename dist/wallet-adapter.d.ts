/**
 * Wallet address adapter to help resolve TypeScript errors
 * This utility file provides type adapters for wallet addresses and objects
 */
export interface WalletInterface {
    account: {
        address: string;
        chain: string;
    };
    device: {
        appName: string;
        platform: string;
    };
    features: string[];
}
/**
 * Convert a wallet address string to a structured address object
 * This helps fix TypeScript errors in wallet-commands.ts
 */
export declare function adaptWalletAddress(address: string): {
    address: string;
};
/**
 * Helper for adapting wallet address to include connection time
 */
export declare function adaptWalletWithTimestamp(address: string): {
    address: string;
    connectedAt: number;
};
/**
 * Convert wallet object to string format if needed
 */
export declare function getWalletAddressString(wallet: any): string;
