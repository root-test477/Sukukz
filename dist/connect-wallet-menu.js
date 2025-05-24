"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.walletMenuCallbacks = void 0;
const wallets_1 = require("./ton-connect/wallets");
const bot_manager_1 = require("./bot-manager");
const connector_1 = require("./ton-connect/connector");
const qrcode_1 = __importDefault(require("qrcode"));
const fs = __importStar(require("fs"));
const sdk_1 = require("@tonconnect/sdk");
const utils_1 = require("./utils");
const error_boundary_1 = require("./error-boundary");
exports.walletMenuCallbacks = {
    chose_wallet: onChooseWalletClick,
    select_wallet: onWalletClick,
    universal_qr: onOpenUniversalQRClick
};
function onChooseWalletClick(query, _, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!query.message) {
            console.error('onChooseWalletClick: Message is undefined');
            return;
        }
        const chatId = query.message.chat.id;
        // Get the bot instance
        const bot = bot_manager_1.botManager.getBot(botId);
        if (!bot) {
            console.error(`Bot instance not found for botId: ${botId}`);
            return;
        }
        try {
            const wallets = yield (0, wallets_1.getWallets)();
            yield bot.editMessageReplyMarkup({
                inline_keyboard: [
                    wallets.map(wallet => ({
                        text: wallet.name,
                        callback_data: JSON.stringify({ method: 'select_wallet', data: wallet.appName })
                    })),
                    [
                        {
                            text: '« Back',
                            callback_data: JSON.stringify({
                                method: 'universal_qr'
                            })
                        }
                    ]
                ]
            }, {
                message_id: query.message.message_id,
                chat_id: chatId
            });
        }
        catch (error) {
            console.error('Error in onChooseWalletClick:', error);
            // Send a new message if edit fails
            try {
                yield (0, error_boundary_1.safeSendMessage)(chatId, 'Sorry, there was an error displaying wallet options. Please try /connect again.');
            }
            catch (sendError) {
                console.error('Failed to send error message in onChooseWalletClick:', sendError);
            }
        }
    });
}
function onOpenUniversalQRClick(query, _, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!query.message) {
            console.error('onOpenUniversalQRClick: Message is undefined');
            return;
        }
        const chatId = query.message.chat.id;
        // Get the bot instance
        const bot = bot_manager_1.botManager.getBot(botId);
        if (!bot) {
            console.error(`Bot instance not found for botId: ${botId}`);
            return;
        }
        try {
            const wallets = yield (0, wallets_1.getWallets)();
            const connector = (0, connector_1.getConnector)(chatId, botId);
            const link = connector.connect(wallets);
            try {
                yield editQR(query.message, link);
            }
            catch (qrError) {
                console.error('Error generating QR code:', qrError);
                // Continue with buttons even if QR fails
            }
            const keyboard = yield (0, utils_1.buildUniversalKeyboard)(link, wallets, botId);
            yield bot.editMessageReplyMarkup({
                inline_keyboard: [keyboard]
            }, {
                message_id: query.message.message_id,
                chat_id: chatId
            });
        }
        catch (error) {
            console.error('Error in onOpenUniversalQRClick:', error);
            try {
                yield (0, error_boundary_1.safeSendMessage)(chatId, 'Sorry, there was an error displaying connection options. Please try /connect again.');
            }
            catch (sendError) {
                console.error('Failed to send error message in onOpenUniversalQRClick:', sendError);
            }
        }
    });
}
function onWalletClick(query, data, botId) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        if (!query.message) {
            console.error('onWalletClick: Message is undefined');
            return;
        }
        const chatId = query.message.chat.id;
        // Get the bot instance
        const bot = bot_manager_1.botManager.getBot(botId);
        if (!bot) {
            console.error(`Bot instance not found for botId: ${botId}`);
            return;
        }
        try {
            const connector = (0, connector_1.getConnector)(chatId, botId);
            const selectedWallet = yield (0, wallets_1.getWalletInfo)(data);
            if (!selectedWallet) {
                yield (0, error_boundary_1.safeSendMessage)(chatId, 'Selected wallet could not be found. Please try /connect again.');
                return;
            }
            let buttonLink = connector.connect({
                bridgeUrl: selectedWallet.bridgeUrl,
                universalLink: selectedWallet.universalLink
            });
            let qrLink = buttonLink;
            if ((0, sdk_1.isTelegramUrl)(selectedWallet.universalLink)) {
                // Get bot-specific link
                const botLink = ((_a = bot_manager_1.botManager.getBotConfig(botId)) === null || _a === void 0 ? void 0 : _a.link) || process.env.TELEGRAM_BOT_LINK || 'https://t.me/your_bot';
                buttonLink = (0, utils_1.addTGReturnStrategy)(buttonLink, botLink);
                qrLink = (0, utils_1.addTGReturnStrategy)(qrLink, 'none');
            }
            try {
                yield editQR(query.message, qrLink, botId);
            }
            catch (qrError) {
                console.error('Error generating QR code in onWalletClick:', qrError);
                // Continue with buttons even if QR fails
            }
            yield bot.editMessageReplyMarkup({
                inline_keyboard: [
                    [
                        {
                            text: '« Back',
                            callback_data: JSON.stringify({ method: 'chose_wallet' })
                        },
                        {
                            text: `Open ${selectedWallet.name}`,
                            url: buttonLink
                        }
                    ]
                ]
            }, {
                message_id: query.message.message_id,
                chat_id: chatId
            });
        }
        catch (error) {
            console.error('Error in onWalletClick:', error);
            try {
                yield (0, error_boundary_1.safeSendMessage)(chatId, 'Sorry, there was an error setting up wallet connection. Please try /connect again.');
            }
            catch (sendError) {
                console.error('Failed to send error message in onWalletClick:', sendError);
            }
        }
    });
}
function editQR(message, link, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!message || !message.message_id || !message.chat) {
            throw new Error('Invalid message object for QR generation');
        }
        // Get the bot instance if botId is provided
        const bot = botId ? bot_manager_1.botManager.getBot(botId) : bot_manager_1.botManager.getBot('main');
        if (!bot) {
            throw new Error(`Bot instance not found for ${botId || 'main'}`);
        }
        const fileName = 'QR-code-' + Math.round(Math.random() * 10000000000);
        try {
            yield qrcode_1.default.toFile(`./${fileName}`, link);
            yield bot.editMessageMedia({
                type: 'photo',
                media: `attach://${fileName}`
            }, {
                message_id: message.message_id,
                chat_id: message.chat.id
            });
        }
        finally {
            // Make sure we clean up the file even if there's an error
            try {
                if (fs.existsSync(`./${fileName}`)) {
                    yield new Promise(resolve => {
                        fs.rm(`./${fileName}`, (err) => {
                            if (err) {
                                console.error(`Failed to remove QR file ${fileName}:`, err);
                            }
                            resolve();
                        });
                    });
                }
            }
            catch (cleanupError) {
                console.error('Error during QR file cleanup:', cleanupError);
            }
        }
    });
}
//# sourceMappingURL=connect-wallet-menu.js.map