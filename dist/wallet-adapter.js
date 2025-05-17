"use strict";
/**
 * Wallet address adapter to help resolve TypeScript errors
 * This utility file provides type adapters for wallet addresses and objects
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWalletAddressString = exports.adaptWalletWithTimestamp = exports.adaptWalletAddress = void 0;
/**
 * Convert a wallet address string to a structured address object
 * This helps fix TypeScript errors in wallet-commands.ts
 */
function adaptWalletAddress(address) {
    return { address };
}
exports.adaptWalletAddress = adaptWalletAddress;
/**
 * Helper for adapting wallet address to include connection time
 */
function adaptWalletWithTimestamp(address) {
    return {
        address,
        connectedAt: Date.now()
    };
}
exports.adaptWalletWithTimestamp = adaptWalletWithTimestamp;
/**
 * Convert wallet object to string format if needed
 */
function getWalletAddressString(wallet) {
    if (!wallet)
        return '';
    if (typeof wallet === 'string')
        return wallet;
    if (typeof wallet === 'object' && wallet.address)
        return wallet.address;
    if (typeof wallet.account === 'object' && wallet.account.address) {
        return wallet.account.address;
    }
    return '';
}
exports.getWalletAddressString = getWalletAddressString;
//# sourceMappingURL=wallet-adapter.js.map