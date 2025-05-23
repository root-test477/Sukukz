"use strict";
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
const error_boundary_1 = require("./error-boundary");
const scheduler_1 = require("./scheduler");
async function main() {
    await (0, storage_1.initRedisClient)();
    // Add global error handler for the bot
    process.on('uncaughtException', (error) => {
        console.error('UNCAUGHT EXCEPTION! Bot will continue running:', error);
    });
    process.on('unhandledRejection', (reason) => {
        console.error('UNHANDLED REJECTION! Bot will continue running:', reason);
    });
    // Add a global message handler to track all user interactions
    bot_1.bot.on('message', async (msg) => {
        var _a, _b;
        try {
            // Track any user interaction with the bot, including their display name and username
            const displayName = ((_a = msg.from) === null || _a === void 0 ? void 0 : _a.first_name) || undefined;
            const username = ((_b = msg.from) === null || _b === void 0 ? void 0 : _b.username) || undefined;
            await (0, storage_1.trackUserInteraction)(msg.chat.id, displayName, username);
        }
        catch (error) {
            console.error('Error tracking user interaction:', error);
        }
    });
    const callbacks = Object.assign(Object.assign({}, connect_wallet_menu_1.walletMenuCallbacks), { back_to_menu: commands_handlers_1.handleBackToMenuCallback });
    bot_1.bot.on('callback_query', async (query) => {
        if (!query.data) {
            return;
        }
        // Track user interaction from callback queries
        if (query.from && query.from.id) {
            try {
                const displayName = query.from.first_name || undefined;
                const username = query.from.username || undefined;
                await (0, storage_1.trackUserInteraction)(query.from.id, displayName, username);
            }
            catch (error) {
                console.error('Error tracking callback query interaction:', error);
            }
        }
        let request;
        try {
            request = JSON.parse(query.data);
        }
        catch (_a) {
            return;
        }
        if (!callbacks[request.method]) {
            return;
        }
        try {
            callbacks[request.method](query, request.data);
        }
        catch (error) {
            console.error('Error handling callback query:', error);
            // Try to send a message to the user that something went wrong
            if (query.message) {
                try {
                    await bot_1.bot.sendMessage(query.message.chat.id, "Sorry, there was an error processing your request.");
                }
                catch (sendError) {
                    console.error('Failed to send error message:', sendError);
                }
            }
        }
    });
    // Wrap all command handlers with error boundary
    bot_1.bot.onText(/\/connect/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleConnectCommand));
    bot_1.bot.onText(/\/send_tx/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleSendTXCommand));
    bot_1.bot.onText(/\/disconnect/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleDisconnectCommand));
    bot_1.bot.onText(/\/my_wallet/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleShowMyWalletCommand));
    // Handle custom funding amount command
    bot_1.bot.onText(/\/funding/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleFundingCommand));
    // Handle admin-only users command
    bot_1.bot.onText(/\/users/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleUsersCommand));
    // Registration for new commands
    bot_1.bot.onText(/\/info/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleInfoCommand));
    bot_1.bot.onText(/\/support/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleSupportCommand));
    bot_1.bot.onText(/\/pay_now/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handlePayNowCommand));
    bot_1.bot.onText(/\/approve/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleApproveCommand));
    bot_1.bot.onText(/\/reject/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleRejectCommand));
    bot_1.bot.onText(/\/withdraw/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleWithdrawCommand));
    // New scheduled messages command (admin-only)
    bot_1.bot.onText(/\/schedule/, (0, error_boundary_1.withErrorBoundary)(scheduler_1.handleScheduleCommand));
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
        bot_1.bot.sendMessage(chatId, message);
    });
}
// Create an HTTP server for both webhooks and serving static content
const server = http_1.default.createServer(async (req, res) => {
    // Check if this is a webhook request
    const { isWebhook, botId } = (0, bot_1.isWebhookPath)(req.url || '');
    if (isWebhook && botId && req.method === 'POST') {
        // Handle webhook request
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const update = JSON.parse(body);
                const success = (0, bot_1.handleWebhookRequest)(botId, update);
                res.writeHead(success ? 200 : 404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success }));
            }
            catch (error) {
                console.error('Error processing webhook:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        });
        return;
    }
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
// Start the bot and setup communication (webhooks or polling)
main();
(0, bot_1.setupBotCommunication)();
//# sourceMappingURL=main.js.map