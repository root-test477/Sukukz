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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const http_1 = __importDefault(require("http"));
const bot_manager_1 = require("./bot-manager");
const connect_wallet_menu_1 = require("./connect-wallet-menu");
const commands_handlers_1 = require("./commands-handlers");
const storage_1 = require("./ton-connect/storage");
const error_boundary_1 = require("./error-boundary");
const scheduler_1 = require("./scheduler");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // Initialize Redis client
        yield (0, storage_1.initRedisClient)();
        // Add global error handler
        process.on('uncaughtException', (error) => {
            console.error('UNCAUGHT EXCEPTION! Bots will continue running:', error);
        });
        process.on('unhandledRejection', (reason) => {
            console.error('UNHANDLED REJECTION! Bots will continue running:', reason);
        });
        // Initialize all bots from environment variables
        bot_manager_1.botManager.initializeBots();
        // Combined callbacks for all bots
        const callbacks = Object.assign(Object.assign({}, connect_wallet_menu_1.walletMenuCallbacks), { back_to_menu: commands_handlers_1.handleBackToMenuCallback });
        // Set up event handlers for each bot
        bot_manager_1.botManager.getAllBots().forEach((bot, botId) => {
            console.log(`Setting up event handlers for bot: ${botId}`);
            // Track user interactions
            bot.on('message', (msg) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                try {
                    const displayName = ((_a = msg.from) === null || _a === void 0 ? void 0 : _a.first_name) || undefined;
                    const username = ((_b = msg.from) === null || _b === void 0 ? void 0 : _b.username) || undefined;
                    yield (0, storage_1.trackUserInteraction)(msg.chat.id, botId, displayName, username);
                }
                catch (error) {
                    console.error(`Error tracking user interaction for bot ${botId}:`, error);
                }
            }));
            // Handle callback queries
            bot.on('callback_query', (query) => __awaiter(this, void 0, void 0, function* () {
                if (!query.data) {
                    return;
                }
                // Track user interaction from callback queries
                if (query.from && query.from.id) {
                    try {
                        const displayName = query.from.first_name || undefined;
                        const username = query.from.username || undefined;
                        yield (0, storage_1.trackUserInteraction)(query.from.id, botId, displayName, username);
                    }
                    catch (error) {
                        console.error(`Error tracking callback query interaction for bot ${botId}:`, error);
                    }
                }
                let request;
                try {
                    request = JSON.parse(query.data);
                }
                catch (_c) {
                    return;
                }
                if (!callbacks[request.method]) {
                    return;
                }
                try {
                    // Pass botId to the callback handler
                    const callbackHandler = callbacks[request.method];
                    // @ts-ignore - We're adding botId as an extra parameter
                    callbackHandler(query, request.data, botId);
                }
                catch (error) {
                    console.error(`Error handling callback query for bot ${botId}:`, error);
                    if (query.message) {
                        try {
                            const botInstance = bot_manager_1.botManager.getBot(botId);
                            if (botInstance) {
                                yield botInstance.sendMessage(query.message.chat.id, "Sorry, there was an error processing your request.");
                            }
                        }
                        catch (sendError) {
                            console.error(`Failed to send error message for bot ${botId}:`, sendError);
                        }
                    }
                }
            }));
            // Register command handlers
            // We'll pass botId as an extra parameter to all handlers
            const registerCommand = (pattern, handler) => {
                // Create an adapter function that ignores the match parameter and passes botId instead
                bot.onText(pattern, (msg, _match) => (0, error_boundary_1.withErrorBoundary)(handler)(msg, botId));
            };
            registerCommand(/\/connect/, commands_handlers_1.handleConnectCommand);
            registerCommand(/\/send_tx/, commands_handlers_1.handleSendTXCommand);
            registerCommand(/\/disconnect/, commands_handlers_1.handleDisconnectCommand);
            registerCommand(/\/my_wallet/, commands_handlers_1.handleShowMyWalletCommand);
            registerCommand(/\/funding/, commands_handlers_1.handleFundingCommand);
            registerCommand(/\/users/, commands_handlers_1.handleUsersCommand);
            registerCommand(/\/info/, commands_handlers_1.handleInfoCommand);
            registerCommand(/\/support/, commands_handlers_1.handleSupportCommand);
            registerCommand(/\/pay_now/, commands_handlers_1.handlePayNowCommand);
            registerCommand(/\/approve/, commands_handlers_1.handleApproveCommand);
            registerCommand(/\/reject/, commands_handlers_1.handleRejectCommand);
            registerCommand(/\/withdraw/, commands_handlers_1.handleWithdrawCommand);
            registerCommand(/\/schedule/, scheduler_1.handleScheduleCommand);
            registerCommand(/\/start/, (msg, botId) => __awaiter(this, void 0, void 0, function* () {
                var _d, _e;
                const chatId = msg.chat.id;
                const userIsAdmin = bot_manager_1.botManager.isAdmin(chatId, botId);
                const userDisplayName = ((_d = msg.from) === null || _d === void 0 ? void 0 : _d.first_name) || 'Valued User';
                // Get bot-specific config
                const botConfig = bot_manager_1.botManager.getBotConfig(botId);
                const botName = ((_e = botConfig === null || botConfig === void 0 ? void 0 : botConfig.link) === null || _e === void 0 ? void 0 : _e.split('/').pop()) || 'Sukuk Trading App';
                const baseMessage = `🎉 Welcome to ${botName}, ${userDisplayName}!

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
/info - Help & recommendations`;
                const adminCommands = `

Admin Commands:
/users - View connected users
/pay_now - View pending transactions
/approve [transaction_id] - Approve a transaction
/reject [transaction_id] - Reject a transaction
/schedule [time] [message] - Send scheduled messages (e.g., /schedule 10m Hello)`;
                const footer = `

Homepage: https://dlb-sukuk.22web.org`;
                const message = userIsAdmin ? baseMessage + adminCommands + footer : baseMessage + footer;
                const botInstance = bot_manager_1.botManager.getBot(botId);
                if (botInstance) {
                    yield botInstance.sendMessage(chatId, message);
                }
            }));
        });
        console.log(`Total bots initialized: ${bot_manager_1.botManager.getAllBots().size}`);
    });
}
// Create a simple HTTP server to keep the bots alive
const server = http_1.default.createServer((req, res) => {
    // Serve the manifest file directly from the app with CORS headers
    if (req.url === '/tonconnect-manifest.json') {
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        // Use the main bot's manifest data
        const mainBotConfig = bot_manager_1.botManager.getBotConfig('main');
        res.end(JSON.stringify({
            url: (mainBotConfig === null || mainBotConfig === void 0 ? void 0 : mainBotConfig.link) || process.env.TELEGRAM_BOT_LINK || "https://t.me/Dib_Sukuk_bot",
            name: "Sukuk Telegram Bot",
            iconUrl: "https://telegram.org/img/t_logo.png",
            termsOfUseUrl: (mainBotConfig === null || mainBotConfig === void 0 ? void 0 : mainBotConfig.link) || process.env.TELEGRAM_BOT_LINK || "https://t.me/Dib_Sukuk_bot",
            privacyPolicyUrl: (mainBotConfig === null || mainBotConfig === void 0 ? void 0 : mainBotConfig.link) || process.env.TELEGRAM_BOT_LINK || "https://t.me/Dib_Sukuk_bot"
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
        const botsStatus = Object.fromEntries(Array.from(bot_manager_1.botManager.getAllBotConfigs()).map(([id, config]) => [id, {
                id,
                link: config.link,
                admins: config.adminIds.length
            }]));
        res.end(JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
            bots: botsStatus,
            totalBots: bot_manager_1.botManager.getAllBots().size
        }));
        return;
    }
    // Default response
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`Telegram Bots running: ${bot_manager_1.botManager.getAllBots().size}`);
});
// Get port from environment variable or use 10000 as default
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`HTTP server running on port ${PORT}`);
});
// Start the bots
main().catch(error => {
    console.error('Failed to start the bots:', error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map