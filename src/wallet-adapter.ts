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
export function adaptWalletAddress(address: string): { address: string } {
  return { address };
}

/**
 * Helper for adapting wallet address to include connection time
 */
export function adaptWalletWithTimestamp(address: string): { 
  address: string; 
  connectedAt: number;
} {
  return { 
    address,
    connectedAt: Date.now()
  };
}

/**
 * Convert wallet object to string format if needed
 */
export function getWalletAddressString(wallet: any): string {
  if (!wallet) return '';
  if (typeof wallet === 'string') return wallet;
  if (typeof wallet === 'object' && wallet.address) return wallet.address;
  if (typeof wallet.account === 'object' && wallet.account.address) {
    return wallet.account.address;
  }
  return '';
}
