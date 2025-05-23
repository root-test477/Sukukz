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
exports.buildUniversalKeyboard = exports.convertDeeplinkToUniversalLink = exports.addTGReturnStrategy = exports.pTimeout = exports.isAdmin = exports.pTimeoutException = exports.AT_WALLET_APP_NAME = exports.getUserById = void 0;
const sdk_1 = require("@tonconnect/sdk");
const bot_manager_1 = require("./bot-manager");
// Import the Redis client directly to access it for our functions
const redis_1 = require("redis");
const client = (0, redis_1.createClient)({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
});
// Function to get a user by their ID
function getUserById(chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Make sure Redis client is connected
            if (!client.isOpen) {
                yield client.connect();
            }
            // Fetch all keys that match this chat ID pattern (across all bots)
            const keys = yield client.keys(`user:${chatId}:*`);
            if (keys.length === 0) {
                return null;
            }
            // Get the most recently active user record
            let mostRecentUser = null;
            for (const key of keys) {
                const userData = yield client.get(key);
                if (userData) {
                    const user = JSON.parse(userData);
                    // Keep track of the most recently active user
                    if (!mostRecentUser || (user.lastActivity > mostRecentUser.lastActivity)) {
                        mostRecentUser = user;
                    }
                }
            }
            return mostRecentUser;
        }
        catch (error) {
            console.error(`Error fetching user ${chatId}:`, error);
            return null;
        }
    });
}
exports.getUserById = getUserById;
exports.AT_WALLET_APP_NAME = 'telegram-wallet';
exports.pTimeoutException = Symbol();
/**
 * Check if a user is an admin based on their chat ID and the bot they're interacting with
 * @param chatId - Telegram chat ID to check
 * @param botId - ID of the bot the user is interacting with
 * @returns true if the user is an admin for this bot, false otherwise
 */
function isAdmin(chatId, botId) {
    return bot_manager_1.botManager.isAdmin(chatId, botId);
}
exports.isAdmin = isAdmin;
function pTimeout(promise, time, exception = exports.pTimeoutException) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_r, rej) => (timer = setTimeout(rej, time, exception)))
    ]).finally(() => clearTimeout(timer));
}
exports.pTimeout = pTimeout;
function addTGReturnStrategy(link, strategy) {
    const parsed = new URL(link);
    parsed.searchParams.append('ret', strategy);
    link = parsed.toString();
    const lastParam = link.slice(link.lastIndexOf('&') + 1);
    return link.slice(0, link.lastIndexOf('&')) + '-' + (0, sdk_1.encodeTelegramUrlParameters)(lastParam);
}
exports.addTGReturnStrategy = addTGReturnStrategy;
function convertDeeplinkToUniversalLink(link, walletUniversalLink) {
    const search = new URL(link).search;
    const url = new URL(walletUniversalLink);
    if ((0, sdk_1.isTelegramUrl)(walletUniversalLink)) {
        const startattach = 'tonconnect-' + (0, sdk_1.encodeTelegramUrlParameters)(search.slice(1));
        url.searchParams.append('startattach', startattach);
    }
    else {
        url.search = search;
    }
    return url.toString();
}
exports.convertDeeplinkToUniversalLink = convertDeeplinkToUniversalLink;
function buildUniversalKeyboard(link, wallets, botId) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const atWallet = wallets.find(wallet => wallet.appName.toLowerCase() === exports.AT_WALLET_APP_NAME);
        // Get bot-specific link
        const botLink = ((_a = bot_manager_1.botManager.getBotConfig(botId)) === null || _a === void 0 ? void 0 : _a.link) || process.env.TELEGRAM_BOT_LINK || '';
        const atWalletLink = atWallet
            ? addTGReturnStrategy(convertDeeplinkToUniversalLink(link, atWallet === null || atWallet === void 0 ? void 0 : atWallet.universalLink), botLink)
            : undefined;
        const keyboard = [
            {
                text: 'Choose a Wallet',
                callback_data: JSON.stringify({ method: 'chose_wallet' })
            },
            {
                text: 'Open Link',
                url: `https://ton-connect.github.io/open-tc?connect=${encodeURIComponent(link)}`
            }
        ];
        if (atWalletLink) {
            keyboard.unshift({
                text: '@wallet',
                url: atWalletLink
            });
        }
        return keyboard;
    });
}
exports.buildUniversalKeyboard = buildUniversalKeyboard;
//# sourceMappingURL=utils.js.map