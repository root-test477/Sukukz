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
const connect_wallet_menu_1 = require("./connect-wallet-menu");
const utils_1 = require("./utils");
const commands_handlers_1 = require("./commands-handlers");
const commands_handlers_missing_1 = require("./commands-handlers-missing");
const storage_1 = require("./ton-connect/storage");
const error_boundary_1 = require("./error-boundary");
const scheduler_1 = require("./scheduler");
const bot_factory_1 = require("./bot-factory");
function initializeBot(bot, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Add a global message handler to track all user interactions
        bot.on('message', (msg) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                // Track any user interaction with the bot, including their display name and username
                const displayName = ((_a = msg.from) === null || _a === void 0 ? void 0 : _a.first_name) || undefined;
                const username = ((_b = msg.from) === null || _b === void 0 ? void 0 : _b.username) || undefined;
                yield (0, storage_1.trackUserInteraction)(msg.chat.id, botId, displayName, username);
            }
            catch (error) {
                console.error(`[Bot ${botId}] Error tracking user interaction:`, error);
            }
        }));
        const callbacks = Object.assign(Object.assign({}, connect_wallet_menu_1.walletMenuCallbacks), { back_to_menu: (query, data) => (0, commands_handlers_missing_1.handleBackToMenuCallback)(query, data, botId) });
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
                    console.error(`[Bot ${botId}] Error tracking callback query interaction:`, error);
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
                callbacks[request.method](query, request.data);
            }
            catch (error) {
                console.error(`[Bot ${botId}] Error handling callback query:`, error);
                // Try to send a message to the user that something went wrong
                if (query.message) {
                    try {
                        yield bot.sendMessage(query.message.chat.id, "Sorry, there was an error processing your request.");
                    }
                    catch (sendError) {
                        console.error(`[Bot ${botId}] Failed to send error message:`, sendError);
                    }
                }
            }
        }));
        // Wrap command handlers with bot ID
        const botSpecificHandlers = {
            connect: (msg) => (0, commands_handlers_1.handleConnectCommand)(msg, botId),
            send_tx: (msg) => (0, commands_handlers_1.handleSendTXCommand)(msg, botId),
            disconnect: (msg) => (0, commands_handlers_1.handleDisconnectCommand)(msg, botId),
            my_wallet: (msg) => (0, commands_handlers_1.handleShowMyWalletCommand)(msg, botId),
            funding: (msg) => (0, commands_handlers_missing_1.handleFundingCommand)(msg, botId),
            users: (msg) => (0, commands_handlers_missing_1.handleUsersCommand)(msg, botId),
            info: (msg) => (0, commands_handlers_missing_1.handleInfoCommand)(msg, botId),
            support: (msg) => (0, commands_handlers_missing_1.handleSupportCommand)(msg, botId),
            pay_now: (msg) => (0, commands_handlers_missing_1.handlePayNowCommand)(msg, botId),
            approve: (msg) => (0, commands_handlers_missing_1.handleApproveCommand)(msg, botId),
            reject: (msg) => (0, commands_handlers_missing_1.handleRejectCommand)(msg, botId),
            withdraw: (msg) => (0, commands_handlers_missing_1.handleWithdrawCommand)(msg, botId),
            schedule: (msg) => (0, scheduler_1.handleScheduleCommand)(msg),
            start: (msg) => (0, commands_handlers_missing_1.handleSupportCommand)(msg, botId) // Use support command as start handler
        };
        // Register command handlers with error boundary
        bot.onText(/\/connect/, (0, error_boundary_1.withErrorBoundary)(botSpecificHandlers.connect));
        bot.onText(/\/send_tx/, (0, error_boundary_1.withErrorBoundary)(botSpecificHandlers.send_tx));
        bot.onText(/\/disconnect/, (0, error_boundary_1.withErrorBoundary)(botSpecificHandlers.disconnect));
        bot.onText(/\/my_wallet/, (0, error_boundary_1.withErrorBoundary)(botSpecificHandlers.my_wallet));
        bot.onText(/\/funding/, (0, error_boundary_1.withErrorBoundary)(botSpecificHandlers.funding));
        bot.onText(/\/users/, (0, error_boundary_1.withErrorBoundary)(botSpecificHandlers.users));
        bot.onText(/\/info/, (0, error_boundary_1.withErrorBoundary)(botSpecificHandlers.info));
        bot.onText(/\/support/, (0, error_boundary_1.withErrorBoundary)(botSpecificHandlers.support));
        bot.onText(/\/pay_now/, (0, error_boundary_1.withErrorBoundary)(botSpecificHandlers.pay_now));
        bot.onText(/\/approve/, (0, error_boundary_1.withErrorBoundary)(botSpecificHandlers.approve));
        bot.onText(/\/reject/, (0, error_boundary_1.withErrorBoundary)(botSpecificHandlers.reject));
        bot.onText(/\/withdraw/, (0, error_boundary_1.withErrorBoundary)(botSpecificHandlers.withdraw));
        bot.onText(/\/schedule/, (0, error_boundary_1.withErrorBoundary)(botSpecificHandlers.schedule));
        bot.onText(/\/start/, (msg) => {
            var _a;
            const chatId = msg.chat.id;
            const userIsAdmin = (0, utils_1.isAdmin)(chatId, botId);
            // Get the user's display name
            const userDisplayName = ((_a = msg.from) === null || _a === void 0 ? void 0 : _a.first_name) || 'Valued User';
            // Get bot name from factory
            const botFactory = bot_factory_1.BotFactory.getInstance();
            const botConfig = botFactory.getBotConfig(botId);
            const botName = (botConfig === null || botConfig === void 0 ? void 0 : botConfig.name) || 'Sukuk Trading App';
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
            bot.sendMessage(chatId, message);
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // Initialize Redis client
        yield (0, storage_1.initRedisClient)();
        // Add global error handlers
        process.on('uncaughtException', (error) => {
            console.error('UNCAUGHT EXCEPTION! Bot will continue running:', error);
        });
        process.on('unhandledRejection', (reason) => {
            console.error('UNHANDLED REJECTION! Bot will continue running:', reason);
        });
        // Initialize the bot factory from environment variables
        const botFactory = bot_factory_1.BotFactory.getInstance();
        botFactory.initializeFromEnv();
        // Get all bot instances and initialize each one
        const bots = botFactory.getAllBots();
        if (bots.size === 0) {
            console.error('No bot configurations found! Please check your environment variables.');
            process.exit(1);
        }
        console.log(`Initializing ${bots.size} bot instances...`);
        // Initialize each bot with its handlers
        for (const [botId, bot] of bots.entries()) {
            console.log(`Initializing bot with ID: ${botId}`);
            yield initializeBot(bot, botId);
        }
        console.log('All bots initialized successfully!');
    });
}
// Create a simple HTTP server to keep the bot alive on Render
const server = http_1.default.createServer((req, res) => {
    var _a;
    // Serve the manifest file directly from the app with CORS headers
    if (req.url === '/tonconnect-manifest.json' || ((_a = req.url) === null || _a === void 0 ? void 0 : _a.startsWith('/tonconnect-manifest-'))) {
        // Get bot ID from URL if specified
        let botId = '';
        const match = req.url.match(/\/tonconnect-manifest-([\w-]+)\.json$/);
        if (match && match[1]) {
            botId = match[1];
        }
        // Get bot-specific data from factory if available
        let botLink = process.env.TELEGRAM_BOT_LINK || "https://t.me/Dib_Sukuk_bot";
        let botName = "Sukuk Telegram Bot";
        if (botId) {
            const botFactory = bot_factory_1.BotFactory.getInstance();
            const botConfig = botFactory.getBotConfig(botId);
            if (botConfig) {
                botLink = botConfig.link || botLink;
                botName = botConfig.name || botName;
            }
        }
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify({
            url: botLink,
            name: botName,
            iconUrl: "https://telegram.org/img/t_logo.png",
            termsOfUseUrl: botLink,
            privacyPolicyUrl: botLink
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