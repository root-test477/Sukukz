"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWalletInfo = exports.getWallets = void 0;
const sdk_1 = require("@tonconnect/sdk");
const walletsListManager = new sdk_1.WalletsListManager({
    cacheTTLMs: Number(process.env.WALLETS_LIST_CACHE_TTL_MS)
});
async function getWallets() {
    const wallets = await walletsListManager.getWallets();
    return wallets.filter(sdk_1.isWalletInfoRemote);
}
exports.getWallets = getWallets;
async function getWalletInfo(walletAppName) {
    const wallets = await getWallets();
    return wallets.find(wallet => wallet.appName.toLowerCase() === walletAppName.toLowerCase());
}
exports.getWalletInfo = getWalletInfo;
//# sourceMappingURL=wallets.js.map