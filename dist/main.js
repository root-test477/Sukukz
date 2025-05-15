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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const http_1 = __importDefault(require("http"));
const bot_1 = require("./bot");
const connect_wallet_menu_1 = require("./connect-wallet-menu");
const utils_1 = require("./utils");
const commands_handlers_1 = require("./commands-handlers");
const storage_1 = require("./ton-connect/storage");
// Import new feature handlers
const language_handler_1 = require("./language-handler");
const tutorial_1 = require("./tutorial");
const analytics_service_1 = require("./analytics-service");
const test_runner_1 = require("./testing/test-runner");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, storage_1.initRedisClient)();
        // Add a global message handler to track all user interactions
        bot_1.bot.on('message', (msg) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                // Track any user interaction with the bot, including their display name and username
                const displayName = ((_a = msg.from) === null || _a === void 0 ? void 0 : _a.first_name) || undefined;
                const username = ((_b = msg.from) === null || _b === void 0 ? void 0 : _b.username) || undefined;
                yield (0, storage_1.trackUserInteraction)(msg.chat.id, displayName, username);
            }
            catch (error) {
                console.error('Error tracking user interaction:', error);
            }
        }));
        const callbacks = Object.assign(Object.assign({}, connect_wallet_menu_1.walletMenuCallbacks), { back_to_menu: commands_handlers_1.handleBackToMenuCallback, 
            // Add callbacks for tutorial navigation
            tutorial_type_general: tutorial_1.handleTutorialTypeCallback, tutorial_type_wallet: tutorial_1.handleTutorialTypeCallback, tutorial_type_transaction: tutorial_1.handleTutorialTypeCallback });
        bot_1.bot.on('callback_query', (query) => __awaiter(this, void 0, void 0, function* () {
            if (!query.data) {
                return;
            }
            // Track user interaction from callback queries
            if (query.from && query.from.id) {
                try {
                    const displayName = query.from.first_name || undefined;
                    const username = query.from.username || undefined;
                    yield (0, storage_1.trackUserInteraction)(query.from.id, displayName, username);
                }
                catch (error) {
                    console.error('Error tracking callback query interaction:', error);
                }
            }
            // Handle language selection callbacks
            if (query.data.startsWith('lang_')) {
                try {
                    yield (0, language_handler_1.handleLanguageCallback)(query);
                    return;
                }
                catch (error) {
                    console.error('Error handling language callback:', error);
                    return;
                }
            }
            // Handle tutorial navigation callbacks
            if (query.data.startsWith('tutorial_')) {
                if (query.data.startsWith('tutorial_type_')) {
                    // Handle tutorial type selection
                    yield (0, tutorial_1.handleTutorialTypeCallback)(query);
                }
                else {
                    // Handle tutorial navigation
                    const Tutorial = (yield Promise.resolve().then(() => __importStar(require('./tutorial')))).Tutorial;
                    yield Tutorial.handleTutorialCallback(query);
                }
                return;
            }
            // Handle standard JSON callbacks for wallet menu etc.
            let request;
            try {
                request = JSON.parse(query.data);
            }
            catch (_c) {
                console.log(`Unhandled callback query: ${query.data}`);
                return;
            }
            if (!callbacks[request.method]) {
                return;
            }
            callbacks[request.method](query, request.data);
        }));
        bot_1.bot.onText(/\/connect/, commands_handlers_1.handleConnectCommand);
        bot_1.bot.onText(/\/send_tx/, commands_handlers_1.handleSendTXCommand);
        bot_1.bot.onText(/\/disconnect/, commands_handlers_1.handleDisconnectCommand);
        bot_1.bot.onText(/\/my_wallet/, commands_handlers_1.handleShowMyWalletCommand);
        // Handle custom funding amount command
        bot_1.bot.onText(/\/funding/, commands_handlers_1.handleFundingCommand);
        // Registration for user-accessible commands
        bot_1.bot.onText(/\/info/, commands_handlers_1.handleInfoCommand);
        bot_1.bot.onText(/\/support/, commands_handlers_1.handleSupportCommand);
        bot_1.bot.onText(/\/pay_now/, commands_handlers_1.handlePayNowCommand);
        bot_1.bot.onText(/\/withdraw/, commands_handlers_1.handleWithdrawCommand);
        bot_1.bot.onText(/\/language/, language_handler_1.handleLanguageCommand);
        bot_1.bot.onText(/\/tutorial/, tutorial_1.handleTutorialCommand);
        // Register admin-only commands with silentFail=true to ignore non-admin access attempts
        bot_1.bot.onText(/\/approve/, (msg) => {
            const chatId = msg.chat.id;
            if (!(0, utils_1.isAdmin)(chatId)) {
                console.log(`[ADMIN] Unauthorized access attempt to /approve by user ${chatId}`);
                return; // Silently fail for non-admins
            }
            (0, commands_handlers_1.handleApproveCommand)(msg);
        });
        bot_1.bot.onText(/\/reject/, (msg) => {
            const chatId = msg.chat.id;
            if (!(0, utils_1.isAdmin)(chatId)) {
                console.log(`[ADMIN] Unauthorized access attempt to /reject by user ${chatId}`);
                return; // Silently fail for non-admins
            }
            (0, commands_handlers_1.handleRejectCommand)(msg);
        });
        bot_1.bot.onText(/\/users/, (msg) => {
            const chatId = msg.chat.id;
            if (!(0, utils_1.isAdmin)(chatId)) {
                console.log(`[ADMIN] Unauthorized access attempt to /users by user ${chatId}`);
                return; // Silently fail for non-admins
            }
            (0, commands_handlers_1.handleUsersCommand)(msg);
        });
        bot_1.bot.onText(/\/analytics/, (msg) => {
            const chatId = msg.chat.id;
            if (!(0, utils_1.isAdmin)(chatId)) {
                console.log(`[ADMIN] Unauthorized access attempt to /analytics by user ${chatId}`);
                return; // Silently fail for non-admins
            }
            (0, analytics_service_1.handleAnalyticsCommand)(msg);
        });
        bot_1.bot.onText(/\/test/, (msg) => {
            const chatId = msg.chat.id;
            if (!(0, utils_1.isAdmin)(chatId)) {
                console.log(`[ADMIN] Unauthorized access attempt to /test by user ${chatId}`);
                return; // Silently fail for non-admins
            }
            (0, test_runner_1.handleTestCommand)(msg);
        });
        bot_1.bot.onText(/\/test_results/, (msg) => {
            const chatId = msg.chat.id;
            if (!(0, utils_1.isAdmin)(chatId)) {
                console.log(`[ADMIN] Unauthorized access attempt to /test_results by user ${chatId}`);
                return; // Silently fail for non-admins
            }
            (0, test_runner_1.handleTestResultsCommand)(msg);
        });
        bot_1.bot.onText(/\/start/, (msg) => {
            var _a;
            const chatId = msg.chat.id;
            const userIsAdmin = (0, utils_1.isAdmin)(chatId);
            // Get the user's display name
            const userDisplayName = ((_a = msg.from) === null || _a === void 0 ? void 0 : _a.first_name) || 'Valued User';
            const baseMessage = `🎉 Welcome to Sukuk Trading App, ${userDisplayName}!

Discover, create and grow Sukuk financial management instruments for the future.

Commands list: 
/connect - Connect to a wallet
/my_wallet - Show connected wallet
/send_tx - Send transaction (100 TON)
/funding [amount] - For custom amount, e.g. /funding 200
/pay_now [transaction_id] - Submit a transaction ID / Hash
/withdraw - Access the withdrawal portal
/disconnect - Disconnect from the wallet
/support [message] - Consult live support assistance
/info - Help & recommendations
/language - Change bot language
/tutorial - Access interactive tutorials`;
            const adminCommands = `

Admin Commands:
/users - View connected users
/pay_now - View pending transactions
/approve [transaction_id] - Approve a transaction
/reject [transaction_id] - Reject a transaction
/analytics - View usage statistics
/test - Run system tests
/test_results - View test results`;
            const footer = `

Homepage: https://dlb-sukuk.22web.org`;
            const message = userIsAdmin ? baseMessage + adminCommands + footer : baseMessage + footer;
            bot_1.bot.sendMessage(chatId, message);
        });
    });
}
// Create a simple HTTP server to keep the bot alive on Render
const server = http_1.default.createServer((req, res) => {
    // Serve the manifest file directly from the app with CORS headers
    if (req.url === '/tonconnect-manifest.json') {
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify({
            url: process.env.TELEGRAM_BOT_LINK || "https://t.me/Dib_Sukuk_bot",
            name: "Sukuk Telegram Bot",
            iconUrl: "https://telegram.org/img/t_logo.png",
            termsOfUseUrl: process.env.TELEGRAM_BOT_LINK || "https://t.me/Dib_Sukuk_bot",
            privacyPolicyUrl: process.env.TELEGRAM_BOT_LINK || "https://t.me/Dib_Sukuk_bot"
        }));
        return;
    }
    // Handle OPTIONS requests for CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400' // 24 hours
        });
        res.end();
        return;
    }
    // Add a basic health check endpoint
    if (req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
        return;
    }
    // Default response
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Telegram Bot is running!');
});
// Get port from environment variable or use 10000 as default
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`HTTP server running on port ${PORT}`);
});
// Start the bot
main();
//# sourceMappingURL=main.js.map