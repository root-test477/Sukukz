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
exports.MyWalletCommand = exports.DisconnectCommand = exports.ConnectCommand = exports.WalletCommand = void 0;
const base_command_1 = require("./base-command");
const error_handler_1 = require("../error-handler");
const bot_1 = require("../bot");
const connector_1 = require("../ton-connect/connector");
const sdk_1 = require("@tonconnect/sdk");
const wallets_1 = require("../ton-connect/wallets");
const wallets_2 = require("../ton-connect/wallets");
const storage_1 = require("../ton-connect/storage");
const qrcode_1 = __importDefault(require("qrcode"));
const utils_1 = require("../utils");
/**
 * Base class for all wallet-related commands
 */
class WalletCommand extends base_command_1.BaseCommand {
    /**
     * Check if a wallet is connected, restore the connection
     * @param chatId Chat ID
     * @returns True if the wallet is connected, false otherwise
     */
    safeRestoreConnection(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const connector = (0, connector_1.getConnector)(chatId);
                yield connector.restoreConnection();
                return connector.connected;
            }
            catch (error) {
                error_handler_1.ErrorHandler.handleError({
                    type: error_handler_1.ErrorType.WALLET_CONNECTION,
                    message: `Error restoring wallet connection: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`,
                    userId: chatId,
                    timestamp: Date.now(),
                    stack: error === null || error === void 0 ? void 0 : error.stack
                });
                return false;
            }
        });
    }
}
exports.WalletCommand = WalletCommand;
/**
 * Connect wallet command
 */
class ConnectCommand extends WalletCommand {
    constructor() {
        super('connect', // command name
        false, // not admin-only
        'Connect to a TON wallet' // description
        );
    }
    /**
     * Implementation of connect command
     */
    executeCommand(msg) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            let messageWasDeleted = false;
            // Cancel any existing connection requests for this chat
            // Note: This would be better handled with a connection manager
            try {
                const connector = (0, connector_1.getConnector)(chatId);
                yield connector.restoreConnection();
                if (connector.connected) {
                    const connectedName = ((_a = (yield (0, wallets_1.getWalletInfo)(connector.wallet.device.appName))) === null || _a === void 0 ? void 0 : _a.name) ||
                        connector.wallet.device.appName;
                    yield bot_1.bot.sendMessage(chatId, `You have already connected ${connectedName} wallet\nYour address: ${(0, sdk_1.toUserFriendlyAddress)(connector.wallet.account.address, connector.wallet.account.chain === sdk_1.CHAIN.TESTNET)}\n\nDisconnect wallet first to connect a new one`);
                    return;
                }
                // Set up wallet connection
                const unsubscribe = connector.onStatusChange((wallet) => __awaiter(this, void 0, void 0, function* () {
                    var _c;
                    if (wallet) {
                        yield deleteMessage();
                        const walletName = ((_c = (yield (0, wallets_1.getWalletInfo)(wallet.device.appName))) === null || _c === void 0 ? void 0 : _c.name) || wallet.device.appName;
                        // Save the connected user to storage
                        yield (0, storage_1.saveConnectedUser)(chatId, wallet.account.address);
                        yield bot_1.bot.sendMessage(chatId, `${walletName} wallet connected successfully`);
                        unsubscribe();
                    }
                }));
                const wallets = yield (0, wallets_2.getWallets)();
                const link = connector.connect(wallets);
                const image = yield qrcode_1.default.toBuffer(link);
                const keyboard = yield (0, utils_1.buildUniversalKeyboard)(link, wallets);
                const botMessage = yield bot_1.bot.sendPhoto(chatId, image, {
                    reply_markup: {
                        inline_keyboard: [keyboard]
                    }
                });
                const deleteMessage = () => __awaiter(this, void 0, void 0, function* () {
                    if (!messageWasDeleted) {
                        messageWasDeleted = true;
                        try {
                            yield bot_1.bot.deleteMessage(chatId, botMessage.message_id);
                        }
                        catch (e) {
                            // Ignore errors deleting message (might be already deleted)
                            console.log(`Failed to delete message: ${(e === null || e === void 0 ? void 0 : e.message) || e}`);
                        }
                    }
                });
            }
            catch (error) {
                error_handler_1.ErrorHandler.handleError({
                    type: error_handler_1.ErrorType.WALLET_CONNECTION,
                    message: `Error connecting wallet: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`,
                    command: this.name,
                    userId: (_b = msg.from) === null || _b === void 0 ? void 0 : _b.id,
                    timestamp: Date.now(),
                    stack: error === null || error === void 0 ? void 0 : error.stack
                });
                throw error; // Re-throw to let the base command error handler manage the user message
            }
        });
    }
}
exports.ConnectCommand = ConnectCommand;
/**
 * Disconnect wallet command
 */
class DisconnectCommand extends WalletCommand {
    constructor() {
        super('disconnect', // command name
        false, // not admin-only
        'Disconnect from connected wallet' // description
        );
    }
    /**
     * Implementation of disconnect command
     */
    executeCommand(msg) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const chatId = msg.chat.id;
                const connector = (0, connector_1.getConnector)(chatId);
                yield connector.restoreConnection();
                if (connector.connected) {
                    connector.disconnect();
                    yield (0, storage_1.removeConnectedUser)(chatId);
                    yield bot_1.bot.sendMessage(chatId, 'Wallet disconnected');
                }
                else {
                    yield bot_1.bot.sendMessage(chatId, 'No wallet connected');
                }
            }
            catch (error) {
                error_handler_1.ErrorHandler.handleError({
                    type: error_handler_1.ErrorType.WALLET_CONNECTION,
                    message: `Error disconnecting wallet: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`,
                    command: this.name,
                    userId: (_a = msg.from) === null || _a === void 0 ? void 0 : _a.id,
                    timestamp: Date.now(),
                    stack: error === null || error === void 0 ? void 0 : error.stack
                });
                throw error; // Re-throw to let the base command error handler manage the user message
            }
        });
    }
}
exports.DisconnectCommand = DisconnectCommand;
/**
 * Show wallet command
 */
class MyWalletCommand extends WalletCommand {
    constructor() {
        super('my_wallet', // command name
        false, // not admin-only
        'Show connected wallet information' // description
        );
    }
    /**
     * Implementation of my_wallet command
     */
    executeCommand(msg) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const chatId = msg.chat.id;
                const connector = (0, connector_1.getConnector)(chatId);
                const connected = yield this.safeRestoreConnection(chatId);
                if (!connected) {
                    yield bot_1.bot.sendMessage(chatId, 'No wallet connected. Use /connect to connect a wallet.');
                    return;
                }
                const walletName = ((_a = (yield (0, wallets_1.getWalletInfo)(connector.wallet.device.appName))) === null || _a === void 0 ? void 0 : _a.name) || connector.wallet.device.appName;
                const address = (0, sdk_1.toUserFriendlyAddress)(connector.wallet.account.address, connector.wallet.account.chain === sdk_1.CHAIN.TESTNET);
                // Get wallet balance (from cache or mock data in our implementation)
                const balance = yield (0, wallets_1.getWalletBalance)(connector.wallet.account.address);
                const balanceDisplay = balance ? `${balance.balance} TON` : 'Not available';
                yield bot_1.bot.sendMessage(chatId, `*Wallet Information*\n\n` +
                    `*Wallet:* ${walletName}\n` +
                    `*Address:* \`${address}\`\n` +
                    `*Balance:* ${balanceDisplay}\n\n` +
                    `Use /disconnect to disconnect this wallet.`, { parse_mode: 'Markdown' });
            }
            catch (error) {
                error_handler_1.ErrorHandler.handleError({
                    type: error_handler_1.ErrorType.WALLET_CONNECTION,
                    message: `Error showing wallet: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`,
                    command: this.name,
                    userId: (_b = msg.from) === null || _b === void 0 ? void 0 : _b.id,
                    timestamp: Date.now(),
                    stack: error === null || error === void 0 ? void 0 : error.stack
                });
                throw error; // Re-throw to let the base command error handler manage the user message
            }
        });
    }
}
exports.MyWalletCommand = MyWalletCommand;
//# sourceMappingURL=wallet-commands.js.map