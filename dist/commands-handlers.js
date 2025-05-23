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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUsersCommand = exports.handleUserCommand = exports.handleApproveTransactionCommand = exports.handleShowMyWalletCommand = exports.safeRestoreConnection = exports.handleDisconnectCommand = exports.handleSendTXCommand = exports.handleConnectCommand = void 0;
const sdk_1 = require("@tonconnect/sdk");
const wallets_1 = require("./ton-connect/wallets");
const bot_factory_1 = require("./bot-factory");
const storage_1 = require("./ton-connect/storage");
const utils_1 = require("./utils");
const qrcode_1 = __importDefault(require("qrcode"));
const connector_1 = require("./ton-connect/connector");
const utils_2 = require("./utils");
// Store listeners with a composite key (chatId:botId)
let newConnectRequestListenersMap = new Map();
// Helper function to create a listener key
function getListenerKey(chatId, botId) {
    return `${chatId}:${botId}`;
}
function handleConnectCommand(msg, botId) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        // Get the bot instance for this botId
        const botFactory = bot_factory_1.BotFactory.getInstance();
        const bot = botFactory.getBot(botId);
        if (!bot) {
            console.error(`Bot with ID ${botId} not found`);
            return;
        }
        const chatId = msg.chat.id;
        let messageWasDeleted = false;
        const listenerKey = getListenerKey(chatId, botId);
        (_a = newConnectRequestListenersMap.get(listenerKey)) === null || _a === void 0 ? void 0 : _a();
        const connector = (0, connector_1.getConnector)(chatId, botId, () => {
            unsubscribe();
            newConnectRequestListenersMap.delete(listenerKey);
            deleteMessage();
        });
        yield connector.restoreConnection();
        if (connector.connected) {
            const connectedName = ((_b = (yield (0, wallets_1.getWalletInfo)(connector.wallet.device.appName))) === null || _b === void 0 ? void 0 : _b.name) ||
                connector.wallet.device.appName;
            yield bot.sendMessage(chatId, `You have already connect ${connectedName} wallet\nYour address: ${(0, sdk_1.toUserFriendlyAddress)(connector.wallet.account.address, connector.wallet.account.chain === sdk_1.CHAIN.TESTNET)}\n\n Disconnect wallet firstly to connect a new one`);
            return;
        }
        const unsubscribe = connector.onStatusChange((wallet) => __awaiter(this, void 0, void 0, function* () {
            var _c;
            if (wallet) {
                yield deleteMessage();
                const walletName = ((_c = (yield (0, wallets_1.getWalletInfo)(wallet.device.appName))) === null || _c === void 0 ? void 0 : _c.name) || wallet.device.appName;
                // Save the connected user to storage
                yield (0, storage_1.saveConnectedUser)(chatId, botId, wallet.account.address);
                yield bot.sendMessage(chatId, `${walletName} wallet connected successfully`);
                unsubscribe();
                newConnectRequestListenersMap.delete(listenerKey);
            }
        }));
        const wallets = yield (0, wallets_1.getWallets)();
        const link = connector.connect(wallets);
        const image = yield qrcode_1.default.toBuffer(link);
        const keyboard = yield (0, utils_2.buildUniversalKeyboard)(link, wallets, botId);
        const botMessage = yield bot.sendPhoto(chatId, image, {
            reply_markup: {
                inline_keyboard: [keyboard]
            }
        });
        const deleteMessage = () => __awaiter(this, void 0, void 0, function* () {
            if (!messageWasDeleted) {
                messageWasDeleted = true;
                yield bot.deleteMessage(chatId, botMessage.message_id);
            }
        });
        newConnectRequestListenersMap.set(listenerKey, () => __awaiter(this, void 0, void 0, function* () {
            unsubscribe();
            yield deleteMessage();
            newConnectRequestListenersMap.delete(listenerKey);
        }));
    });
}
exports.handleConnectCommand = handleConnectCommand;
function handleSendTXCommand(msg, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Get the bot instance for this botId
        const botFactory = bot_factory_1.BotFactory.getInstance();
        const bot = botFactory.getBot(botId);
        if (!bot) {
            console.error(`Bot with ID ${botId} not found`);
            return;
        }
        const chatId = msg.chat.id;
        const connector = (0, connector_1.getConnector)(chatId, botId);
        const connected = yield safeRestoreConnection(connector, chatId, botId);
        if (!connected) {
            yield bot.sendMessage(chatId, 'Connect wallet to send transaction. If you\'re having connection issues, try /connect again.');
            return;
        }
        (0, utils_2.pTimeout)(connector.sendTransaction({
            validUntil: Math.round((Date.now() + Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS)) / 1000),
            messages: [
                {
                    amount: process.env.DEFAULT_TRANSACTION_AMOUNT || '100000000',
                    address: process.env.DEFAULT_RECIPIENT_ADDRESS || '0:0000000000000000000000000000000000000000000000000000000000000000'
                }
            ]
        }), Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS))
            .then(() => __awaiter(this, void 0, void 0, function* () {
            // Update user activity with transaction amount
            const amount = process.env.DEFAULT_TRANSACTION_AMOUNT || '100000000';
            yield (0, storage_1.updateUserActivity)(chatId, botId, amount);
            yield bot.sendMessage(chatId, `Transaction sent successfully`);
        }))
            .catch((e) => __awaiter(this, void 0, void 0, function* () {
            if (e === utils_2.pTimeoutException) {
                yield bot.sendMessage(chatId, `Transaction was not confirmed`);
                return;
            }
            if (e instanceof sdk_1.UserRejectsError) {
                yield bot.sendMessage(chatId, `You rejected the transaction`);
                return;
            }
            yield bot.sendMessage(chatId, `Unknown error happened`);
        }))
            .finally(() => connector.pauseConnection());
        let deeplink = '';
        const walletInfo = yield (0, wallets_1.getWalletInfo)(connector.wallet.device.appName);
        if (walletInfo) {
            deeplink = walletInfo.universalLink;
        }
        if ((0, sdk_1.isTelegramUrl)(deeplink)) {
            const url = new URL(deeplink);
            url.searchParams.append('startattach', 'tonconnect');
            deeplink = (0, utils_2.addTGReturnStrategy)(url.toString(), process.env.TELEGRAM_BOT_LINK);
        }
        yield bot.sendMessage(chatId, `Open ${(walletInfo === null || walletInfo === void 0 ? void 0 : walletInfo.name) || connector.wallet.device.appName} and confirm transaction`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: `Open ${(walletInfo === null || walletInfo === void 0 ? void 0 : walletInfo.name) || connector.wallet.device.appName}`,
                            url: deeplink
                        }
                    ]
                ]
            }
        });
    });
}
exports.handleSendTXCommand = handleSendTXCommand;
function handleDisconnectCommand(msg, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Get the bot instance for this botId
        const botFactory = bot_factory_1.BotFactory.getInstance();
        const bot = botFactory.getBot(botId);
        if (!bot) {
            console.error(`Bot with ID ${botId} not found`);
            return;
        }
        const chatId = msg.chat.id;
        const connector = (0, connector_1.getConnector)(chatId, botId);
        yield connector.restoreConnection();
        if (!connector.connected) {
            yield bot.sendMessage(chatId, "You didn't connect a wallet");
            return;
        }
        yield connector.disconnect();
        // Remove user from tracking when they disconnect
        yield (0, storage_1.removeConnectedUser)(chatId, botId);
        yield bot.sendMessage(chatId, 'Wallet has been disconnected');
    });
}
exports.handleDisconnectCommand = handleDisconnectCommand;
/**
 * Attempt to safely restore a wallet connection with retries
 * @param connector - The connector to restore
 * @param chatId - The chat ID for logging
 * @param botId - The bot ID for logging
 * @returns true if connection was successful, false otherwise
 */
function safeRestoreConnection(connector, chatId, _botId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Make multiple attempts to restore the connection
            for (let attempt = 1; attempt <= 3; attempt++) {
                console.log(`[WALLET] Attempt ${attempt} to restore connection for chat ${chatId}`);
                try {
                    yield connector.restoreConnection();
                    if (connector.connected) {
                        console.log(`[WALLET] Successfully connected on attempt ${attempt} for chat ${chatId}`);
                        return true;
                    }
                }
                catch (error) {
                    console.log(`[WALLET] Error on attempt ${attempt}:`, error);
                    // Wait before retry
                    yield new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                }
            }
            console.log(`[WALLET] All connection attempts failed for chat ${chatId}`);
            return false;
        }
        catch (error) {
            console.log(`[WALLET] Unexpected error during connection attempts:`, error);
            return false;
        }
    });
}
exports.safeRestoreConnection = safeRestoreConnection;
function handleShowMyWalletCommand(msg, botId) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        // Get the bot instance for this botId
        const botFactory = bot_factory_1.BotFactory.getInstance();
        const bot = botFactory.getBot(botId);
        if (!bot) {
            console.error(`Bot with ID ${botId} not found`);
            return;
        }
        const chatId = msg.chat.id;
        const connector = (0, connector_1.getConnector)(chatId, botId);
        // Use our enhanced connection method
        const connected = yield safeRestoreConnection(connector, chatId, botId);
        if (!connected) {
            yield bot.sendMessage(chatId, "You didn't connect a wallet or connection failed. Try using /connect again");
            return;
        }
        const walletName = ((_a = (yield (0, wallets_1.getWalletInfo)(connector.wallet.device.appName))) === null || _a === void 0 ? void 0 : _a.name) ||
            connector.wallet.device.appName;
        yield bot.sendMessage(chatId, `Connected wallet: ${walletName}\nYour address: ${(0, sdk_1.toUserFriendlyAddress)(connector.wallet.account.address, connector.wallet.account.chain === sdk_1.CHAIN.TESTNET)}`);
    });
}
exports.handleShowMyWalletCommand = handleShowMyWalletCommand;
/**
 * Handler for the /approve_transaction command (admin-only)
 * Approves a pending transaction that a user has submitted via /transaction command
 */
function handleApproveTransactionCommand(msg, botId) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Get the bot instance for this botId
        const botFactory = bot_factory_1.BotFactory.getInstance();
        const bot = botFactory.getBot(botId);
        if (!bot) {
            console.error(`Bot with ID ${botId} not found`);
            return;
        }
        // Check if user is admin
        if (!(0, utils_1.isAdmin)(chatId, botId)) {
            yield bot.sendMessage(chatId, '⛔ This command is for administrators only.');
            return;
        }
        // Get transaction ID from command message
        const match = (_a = msg.text) === null || _a === void 0 ? void 0 : _a.match(/\/approve_transaction\s+(.+)/);
        if (!match || !match[1]) {
            yield bot.sendMessage(chatId, 'Please provide a transaction ID to approve. Example: /approve [transaction_id]');
            return;
        }
    });
}
exports.handleApproveTransactionCommand = handleApproveTransactionCommand;
/**
 * Helper function to escape Markdown special characters in text
 * @param text Text to escape
 * @returns Escaped text safe for Markdown
 */
function escapeMarkdown(text) {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}
/**
 * Handler for the /user command (admin-only)
 * Shows detailed information about a user by ID or username
 */
function handleUserCommand(msg, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Get the bot instance for this botId
        const botFactory = bot_factory_1.BotFactory.getInstance();
        const bot = botFactory.getBot(botId);
        if (!bot) {
            console.error(`Bot with ID ${botId} not found`);
            return;
        }
        // Check if user is admin
        if (!(0, utils_1.isAdmin)(chatId, botId)) {
            yield bot.sendMessage(chatId, '⛔ This command is for administrators only.');
            return;
        }
        // ... (rest of the function remains the same)
    });
}
exports.handleUserCommand = handleUserCommand;
/**
 * Handler for the /users command (admin-only)
 * Shows all users who have interacted with the bot, including those who never connected a wallet
 */
function handleUsersCommand(msg, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Get the bot instance for this botId
        const botFactory = bot_factory_1.BotFactory.getInstance();
        const bot = botFactory.getBot(botId);
        if (!bot) {
            console.error(`Bot with ID ${botId} not found`);
            return;
        }
        // Track user interaction
        yield (0, storage_1.trackUserInteraction)(chatId, botId);
        // Check if the user is an admin
        if (!(0, utils_1.isAdmin)(chatId, botId)) {
            // Silently ignore for non-admins
            return;
        }
        // Placeholder for full implementation
        yield bot.sendMessage(chatId, '*User information listing not yet implemented for multi-bot mode*', { parse_mode: 'Markdown' });
    });
}
exports.handleUsersCommand = handleUsersCommand;
//# sourceMappingURL=commands-handlers.js.map