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
const redis_1 = require("redis");
const storage_1 = require("./ton-connect/storage");
const error_boundary_1 = require("./error-boundary");
const scheduler_1 = require("./scheduler");
const utils_1 = require("./utils");
// Redis client for transaction cache
const client = (0, redis_1.createClient)({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
});
// Ensure Redis client is connected
(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!client.isOpen) {
            yield client.connect();
        }
    }
    catch (error) {
        console.error('Redis connection error:', error);
    }
}))();
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
        // Combined callbacks for all bots - use any here to satisfy TypeScript without complex union types
        // We'll handle the actual type safety in the callback execution logic
        const callbacks = Object.assign(Object.assign({}, connect_wallet_menu_1.walletMenuCallbacks), { back_to_menu: commands_handlers_1.handleBackToMenuCallback, 
            // Add transaction approval and rejection callbacks
            approve_tx: (bot, query, botId) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                try {
                    if (!query.data)
                        return;
                    const data = JSON.parse(query.data);
                    const index = data.index;
                    const chatId = (_a = query.message) === null || _a === void 0 ? void 0 : _a.chat.id;
                    if (!chatId)
                        return;
                    // Only allow admins to approve transactions
                    if (!(0, utils_1.isAdmin)(chatId, botId)) {
                        yield bot.answerCallbackQuery(query.id, {
                            text: 'Only administrators can approve transactions',
                            show_alert: true
                        });
                        return;
                    }
                    // Get the transaction ID from the cache
                    const txCacheKey = `txCache:${botId}`;
                    const txCacheData = yield client.get(txCacheKey);
                    if (!txCacheData) {
                        yield bot.answerCallbackQuery(query.id, {
                            text: 'Transaction cache expired. Please run /pay_now again.',
                            show_alert: true
                        });
                        return;
                    }
                    const txCache = JSON.parse(txCacheData);
                    if (index < 0 || index >= txCache.length) {
                        yield bot.answerCallbackQuery(query.id, {
                            text: 'Invalid transaction index',
                            show_alert: true
                        });
                        return;
                    }
                    // Get the transaction ID and create a modified message
                    const transactionId = txCache[index];
                    const modifiedMsg = {
                        chat: { id: chatId },
                        from: query.from,
                        text: `/approve ${transactionId}`
                    };
                    // Process the approval
                    yield (0, commands_handlers_1.handleApproveCommand)(modifiedMsg, botId);
                    // Update the inline keyboard to remove the approved transaction
                    if (query.message) {
                        const newTxCache = [...txCache];
                        newTxCache.splice(index, 1);
                        // Update the cache
                        yield client.set(txCacheKey, JSON.stringify(newTxCache), {
                            EX: 3600 // Cache for 1 hour
                        });
                        // Answer the callback query
                        yield bot.answerCallbackQuery(query.id, {
                            text: 'Transaction approved successfully!'
                        });
                    }
                }
                catch (error) {
                    console.error('Error in approve_tx callback:', error);
                    if (query.id) {
                        yield bot.answerCallbackQuery(query.id, {
                            text: 'An error occurred while processing the approval',
                            show_alert: true
                        });
                    }
                }
            }), reject_tx: (bot, query, botId) => __awaiter(this, void 0, void 0, function* () {
                var _b;
                try {
                    if (!query.data)
                        return;
                    const data = JSON.parse(query.data);
                    const index = data.index;
                    const chatId = (_b = query.message) === null || _b === void 0 ? void 0 : _b.chat.id;
                    if (!chatId)
                        return;
                    // Only allow admins to reject transactions
                    if (!(0, utils_1.isAdmin)(chatId, botId)) {
                        yield bot.answerCallbackQuery(query.id, {
                            text: 'Only administrators can reject transactions',
                            show_alert: true
                        });
                        return;
                    }
                    // Get the transaction ID from the cache
                    const txCacheKey = `txCache:${botId}`;
                    const txCacheData = yield client.get(txCacheKey);
                    if (!txCacheData) {
                        yield bot.answerCallbackQuery(query.id, {
                            text: 'Transaction cache expired. Please run /pay_now again.',
                            show_alert: true
                        });
                        return;
                    }
                    const txCache = JSON.parse(txCacheData);
                    if (index < 0 || index >= txCache.length) {
                        yield bot.answerCallbackQuery(query.id, {
                            text: 'Invalid transaction index',
                            show_alert: true
                        });
                        return;
                    }
                    // Get the transaction ID and create a modified message
                    const transactionId = txCache[index];
                    const modifiedMsg = {
                        chat: { id: chatId },
                        from: query.from,
                        text: `/reject ${transactionId}`
                    };
                    // Process the rejection
                    yield (0, commands_handlers_1.handleRejectCommand)(modifiedMsg, botId);
                    // Update the inline keyboard to remove the rejected transaction
                    if (query.message) {
                        const newTxCache = [...txCache];
                        newTxCache.splice(index, 1);
                        // Update the cache
                        yield client.set(txCacheKey, JSON.stringify(newTxCache), {
                            EX: 3600 // Cache for 1 hour
                        });
                        // Answer the callback query
                        yield bot.answerCallbackQuery(query.id, {
                            text: 'Transaction rejected successfully!'
                        });
                    }
                }
                catch (error) {
                    console.error('Error in reject_tx callback:', error);
                    if (query.id) {
                        yield bot.answerCallbackQuery(query.id, {
                            text: 'An error occurred while processing the rejection',
                            show_alert: true
                        });
                    }
                }
            }) });
        // Set up event handlers for each bot
        bot_manager_1.botManager.getAllBots().forEach((bot, botId) => {
            console.log(`Setting up handlers for bot: ${botId}`);
            // Handle /start command for new users
            bot.onText(/\/start/, (0, error_boundary_1.withErrorBoundary)((msg) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c, _d;
                const chatId = msg.chat.id;
                // Track user interaction
                try {
                    const displayName = ((_a = msg.from) === null || _a === void 0 ? void 0 : _a.first_name) || undefined;
                    const username = ((_b = msg.from) === null || _b === void 0 ? void 0 : _b.username) || undefined;
                    yield (0, storage_1.trackUserInteraction)(chatId, botId, displayName, username);
                }
                catch (error) {
                    console.error(`Error tracking user interaction for bot ${botId}:`, error);
                }
                // Check if the user is an admin
                const userIsAdmin = (0, utils_1.isAdmin)(chatId, botId);
                // Get user display name or default to "there"
                const userDisplayName = ((_c = msg.from) === null || _c === void 0 ? void 0 : _c.first_name) || 'there';
                // Get bot-specific information
                const botConfig = bot_manager_1.botManager.getBotConfig(botId);
                const botName = ((_d = botConfig === null || botConfig === void 0 ? void 0 : botConfig.link) === null || _d === void 0 ? void 0 : _d.split('/').pop()) || 'Sukuk Trading App';
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
            })));
            // Track user interaction for all incoming messages
            bot.on('message', (msg) => __awaiter(this, void 0, void 0, function* () {
                var _e, _f;
                try {
                    const displayName = ((_e = msg.from) === null || _e === void 0 ? void 0 : _e.first_name) || undefined;
                    const username = ((_f = msg.from) === null || _f === void 0 ? void 0 : _f.username) || undefined;
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
                        console.error(`Error tracking user interaction from callback for bot ${botId}:`, error);
                    }
                }
                try {
                    const data = JSON.parse(query.data);
                    const { method, data: methodData } = data;
                    if (method && callbacks[method]) {
                        // Check if it's a wallet menu callback which expects query as first param
                        if (method === 'chose_wallet' || method === 'select_wallet' || method === 'universal_qr') {
                            // Wallet menu callbacks expect query as first param
                            yield callbacks[method](query, methodData || '', botId);
                        }
                        else {
                            // Our custom callbacks expect bot as first param
                            yield callbacks[method](bot, query, botId);
                        }
                    }
                    else {
                        console.warn(`Unknown callback method: ${method}`);
                        yield bot.answerCallbackQuery(query.id, {
                            text: 'Unknown action',
                            show_alert: true
                        });
                    }
                }
                catch (e) {
                    console.error('Error processing callback query:', e);
                    try {
                        yield bot.answerCallbackQuery(query.id, {
                            text: 'An error occurred while processing your request',
                            show_alert: true
                        });
                    }
                    catch (error) {
                        console.error('Failed to send error response for callback query:', error);
                    }
                }
            }));
            // Register command handlers
            // We'll pass botId as an extra parameter to all handlers
            const registerCommand = (pattern, handler) => {
                // Create an adapter function that ignores the match parameter and passes botId instead
                bot.onText(pattern, (msg, _match) => (0, error_boundary_1.withErrorBoundary)(handler)(msg, botId));
            };
            // Handle quick action commands for transaction approvals and rejections
            bot.onText(/\/approve_(\d+)/i, (0, error_boundary_1.withErrorBoundary)((msg, match) => __awaiter(this, void 0, void 0, function* () {
                // Extract the transaction index from the command
                // Fix TypeScript error by properly handling potentially undefined match
                const txIndex = (match && match[1]) ? parseInt(match[1]) - 1 : -1;
                if (txIndex >= 0) {
                    // Get the transaction ID from the cache
                    const txCacheKey = `txCache:${botId}`;
                    const txCacheData = yield client.get(txCacheKey);
                    if (txCacheData) {
                        const txCache = JSON.parse(txCacheData);
                        if (txIndex < txCache.length) {
                            // Found the transaction ID, call the approve command with this ID
                            const transactionId = txCache[txIndex];
                            // Create a modified message with the approve command
                            const modifiedMsg = Object.assign(Object.assign({}, msg), { text: `/approve ${transactionId}` });
                            yield (0, commands_handlers_1.handleApproveCommand)(modifiedMsg, botId);
                        }
                        else {
                            yield (0, error_boundary_1.safeSendMessage)(msg.chat.id, 'Transaction index not found. Run /pay_now to see the current list.', undefined, botId);
                        }
                    }
                    else {
                        yield (0, error_boundary_1.safeSendMessage)(msg.chat.id, 'Transaction cache expired. Run /pay_now to refresh the list.', undefined, botId);
                    }
                }
                else {
                    yield (0, error_boundary_1.safeSendMessage)(msg.chat.id, 'Invalid transaction index format.', undefined, botId);
                }
            })));
            bot.onText(/\/reject_(\d+)/i, (0, error_boundary_1.withErrorBoundary)((msg, match) => __awaiter(this, void 0, void 0, function* () {
                // Extract the transaction index from the command
                // Fix TypeScript error by properly handling potentially undefined match
                const txIndex = (match && match[1]) ? parseInt(match[1]) - 1 : -1;
                if (txIndex >= 0) {
                    // Get the transaction ID from the cache
                    const txCacheKey = `txCache:${botId}`;
                    const txCacheData = yield client.get(txCacheKey);
                    if (txCacheData) {
                        const txCache = JSON.parse(txCacheData);
                        if (txIndex < txCache.length) {
                            // Found the transaction ID, call the reject command with this ID
                            const transactionId = txCache[txIndex];
                            // Create a modified message with the reject command
                            const modifiedMsg = Object.assign(Object.assign({}, msg), { text: `/reject ${transactionId}` });
                            yield (0, commands_handlers_1.handleRejectCommand)(modifiedMsg, botId);
                        }
                        else {
                            yield (0, error_boundary_1.safeSendMessage)(msg.chat.id, 'Transaction index not found. Run /pay_now to see the current list.', undefined, botId);
                        }
                    }
                    else {
                        yield (0, error_boundary_1.safeSendMessage)(msg.chat.id, 'Transaction cache expired. Run /pay_now to refresh the list.', undefined, botId);
                    }
                }
                else {
                    yield (0, error_boundary_1.safeSendMessage)(msg.chat.id, 'Invalid transaction index format.', undefined, botId);
                }
            })));
            // Handle quick action commands for bot management and scheduling
            bot.onText(/\/scheduleMessage/i, (0, error_boundary_1.withErrorBoundary)((msg) => __awaiter(this, void 0, void 0, function* () {
                yield (0, scheduler_1.handleScheduleCommand)(msg, botId);
            })));
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