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
exports.MyWalletCommand = exports.DisconnectCommand = exports.ConnectCommand = exports.WalletCommand = void 0;
const base_command_1 = require("./base-command");
const bot_1 = require("../bot");
const connector_1 = require("../ton-connect/connector");
const wallets_1 = require("../ton-connect/wallets");
const error_handler_1 = require("../error-handler");
/**
 * Base class for wallet-related commands
 */
class WalletCommand extends base_command_1.BaseCommand {
}
exports.WalletCommand = WalletCommand;
/**
 * Command to connect a wallet
 */
class ConnectCommand extends WalletCommand {
    constructor() {
        super('connect', 'Connect your TON wallet');
    }
    execute(msg, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            try {
                // Check if user already has a connected wallet
                const connectedWallet = yield (0, connector_1.getConnectedWallet)(chatId);
                if (connectedWallet) {
                    yield bot_1.bot.sendMessage(chatId, `You already have a connected wallet: ${connectedWallet.address}\n\nUse /disconnect if you want to connect a different wallet.`);
                    return;
                }
                // Send connection instructions
                const qrCodeUrl = 'https://example.com/connect-qr'; // In a real implementation, generate a QR code
                yield bot_1.bot.sendPhoto(chatId, qrCodeUrl, {
                    caption: 'Scan this QR code with your TON wallet to connect, or click the link below:',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Connect with @wallet', url: 'https://t.me/wallet' }]
                        ]
                    }
                });
            }
            catch (error) {
                if (error instanceof Error) {
                    yield error_handler_1.ErrorHandler.handleError(error, error_handler_1.ErrorType.WALLET_CONNECTION, {
                        commandName: 'connect',
                        userId: chatId,
                        message: msg.text || ''
                    });
                }
                yield bot_1.bot.sendMessage(chatId, '\u274c Error initiating wallet connection. Please try again later.');
            }
        });
    }
}
exports.ConnectCommand = ConnectCommand;
/**
 * Command to disconnect a wallet
 */
class DisconnectCommand extends WalletCommand {
    constructor() {
        super('disconnect', 'Disconnect your TON wallet');
    }
    execute(msg, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            try {
                // Check if user has a connected wallet
                const connectedWallet = yield (0, connector_1.getConnectedWallet)(chatId);
                if (!connectedWallet) {
                    yield bot_1.bot.sendMessage(chatId, 'You don\'t have a connected wallet. Use /connect to connect one.');
                    return;
                }
                // Disconnect the wallet
                yield (0, connector_1.disconnectWallet)(chatId);
                yield bot_1.bot.sendMessage(chatId, '\u2705 Your wallet has been disconnected. Use /connect to connect again whenever you\'re ready.');
            }
            catch (error) {
                if (error instanceof Error) {
                    yield error_handler_1.ErrorHandler.handleError(error, error_handler_1.ErrorType.WALLET_CONNECTION, {
                        commandName: 'disconnect',
                        userId: chatId,
                        message: msg.text || ''
                    });
                }
                yield bot_1.bot.sendMessage(chatId, '\u274c Error disconnecting wallet. Please try again later.');
            }
        });
    }
}
exports.DisconnectCommand = DisconnectCommand;
/**
 * Command to view wallet details
 */
class MyWalletCommand extends WalletCommand {
    constructor() {
        super('mywallet', 'View your connected wallet details');
    }
    execute(msg, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            try {
                // Check if user has a connected wallet
                const connectedWallet = yield (0, connector_1.getConnectedWallet)(chatId);
                if (!connectedWallet) {
                    yield bot_1.bot.sendMessage(chatId, 'You don\'t have a connected wallet. Use /connect to connect one.');
                    return;
                }
                // Get wallet balance
                const balance = yield (0, wallets_1.getWalletBalance)(connectedWallet.address);
                // Format wallet info message
                const walletInfo = `\ud83d\udcb0 *Wallet Information* \ud83d\udcb0\n\n` +
                    `*Address:* \`${connectedWallet.address}\`\n\n` +
                    `*Balance:* ${balance}\n\n` +
                    `*Connection Date:* ${new Date(connectedWallet.connectedAt).toLocaleString()}\n\n` +
                    `Use /disconnect to disconnect this wallet.`;
                yield bot_1.bot.sendMessage(chatId, walletInfo, { parse_mode: 'Markdown' });
            }
            catch (error) {
                if (error instanceof Error) {
                    yield error_handler_1.ErrorHandler.handleError(error, error_handler_1.ErrorType.WALLET_CONNECTION, {
                        commandName: 'mywallet',
                        userId: chatId,
                        message: msg.text || ''
                    });
                }
                yield bot_1.bot.sendMessage(chatId, '\u274c Error fetching wallet details. Please try again later.');
            }
        });
    }
}
exports.MyWalletCommand = MyWalletCommand;
//# sourceMappingURL=wallet-commands.js.map