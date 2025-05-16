"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWalletBalance = exports.getWalletInfo = exports.getWallets = void 0;
const sdk_1 = require("@tonconnect/sdk");
const wallet_cache_1 = require("../caching/wallet-cache");
const error_handler_1 = require("../error-handler");
const walletsListManager = new sdk_1.WalletsListManager({
    cacheTTLMs: Number(process.env.WALLETS_LIST_CACHE_TTL_MS)
});
const walletCache = wallet_cache_1.WalletCache.getInstance();
/**
 * Get all available wallets
 * Implements caching to reduce API calls
 */
function getWallets() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Check if we have wallets in cache
            const cachedWallets = walletCache.getWalletInfo('all_wallets');
            if (cachedWallets) {
                return cachedWallets;
            }
            // If not cached, fetch from API
            const wallets = yield walletsListManager.getWallets();
            const filteredWallets = wallets.filter(sdk_1.isWalletInfoRemote);
            // Cache the result
            walletCache.setWalletInfo('all_wallets', filteredWallets);
            return filteredWallets;
        }
        catch (error) {
            error_handler_1.ErrorHandler.handleError({
                type: error_handler_1.ErrorType.WALLET_CONNECTION,
                message: `Error fetching wallets: ${error instanceof Error ? error.message : String(error)}`,
                timestamp: Date.now(),
                stack: error instanceof Error ? error.stack : undefined
            });
            // Return empty array on error
            return [];
        }
    });
}
exports.getWallets = getWallets;
/**
 * Get information about a specific wallet
 * Uses caching to improve performance
 * @param walletAppName The wallet app name
 */
function getWalletInfo(walletAppName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!walletAppName)
                return undefined;
            // Normalize wallet app name for caching
            const normalizedName = walletAppName.toLowerCase();
            // Check if we have this wallet info in cache
            const cachedInfo = walletCache.getWalletInfo(normalizedName);
            if (cachedInfo) {
                return cachedInfo;
            }
            // If not cached, fetch all wallets and find the one we need
            const wallets = yield getWallets();
            const walletInfo = wallets.find(wallet => wallet.appName.toLowerCase() === normalizedName);
            if (walletInfo) {
                // Cache the result
                walletCache.setWalletInfo(normalizedName, walletInfo);
            }
            return walletInfo;
        }
        catch (error) {
            error_handler_1.ErrorHandler.handleError({
                type: error_handler_1.ErrorType.WALLET_CONNECTION,
                message: `Error fetching wallet info for ${walletAppName}: ${error instanceof Error ? error.message : String(error)}`,
                timestamp: Date.now(),
                stack: error instanceof Error ? error.stack : undefined
            });
            return undefined;
        }
    });
}
exports.getWalletInfo = getWalletInfo;
/**
 * Get wallet balance (placeholder - actual implementation would fetch from blockchain)
 * @param address Wallet address
 */
function getWalletBalance(address) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!address)
                return undefined;
            // Check if we have balance in cache
            const cachedBalance = walletCache.getWalletBalance(address);
            if (cachedBalance) {
                return cachedBalance;
            }
            // In a real implementation, this would fetch the balance from a blockchain API
            // For now, we'll return a mock balance
            const mockBalance = {
                balance: Math.floor(Math.random() * 10000) / 100,
                lastUpdated: Date.now()
            };
            // Cache the result
            walletCache.setWalletBalance(address, mockBalance);
            return mockBalance;
        }
        catch (error) {
            error_handler_1.ErrorHandler.handleError({
                type: error_handler_1.ErrorType.WALLET_CONNECTION,
                message: `Error fetching wallet balance for ${address}: ${error instanceof Error ? error.message : String(error)}`,
                timestamp: Date.now(),
                stack: error instanceof Error ? error.stack : undefined
            });
            return undefined;
        }
    });
}
exports.getWalletBalance = getWalletBalance;
//# sourceMappingURL=wallets.js.map