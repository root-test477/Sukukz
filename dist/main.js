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
const bot_1 = require("./bot");
const connect_wallet_menu_1 = require("./connect-wallet-menu");
const utils_1 = require("./utils");
const commands_handlers_1 = require("./commands-handlers");
const storage_1 = require("./ton-connect/storage");
const error_handler_1 = require("./error-handler");
const tutorial_system_1 = require("./tutorial-system");
const inline_capabilities_1 = require("./inline-capabilities");
const scheduled_messages_1 = require("./scheduled-messages");
const analytics_command_1 = require("./commands/analytics-command");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // Set up global error handling
        (0, error_handler_1.setupGlobalErrorHandlers)();
        // Initialize Redis client
        yield (0, storage_1.initRedisClient)();
        console.log('Initializing TON Connect Telegram Bot...');
        // Initialize error handlers and admin commands
        console.log('Setting up error handling and admin commands...');
        // Add a global message handler to track all user interactions
        bot_1.bot.on('message', (msg) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                // Track any user interaction with the bot, including their display name and username
                const displayName = ((_a = msg.from) === null || _a === void 0 ? void 0 : _a.first_name) || undefined;
                const username = ((_b = msg.from) === null || _b === void 0 ? void 0 : _b.username) || undefined;
                yield (0, storage_1.trackUserInteraction)(msg.chat.id, displayName, username);
                // Track analytics event
                if (msg.text && msg.text.startsWith('/') && msg.chat && msg.chat.id) {
                    const command = ((_d = (_c = msg.text) === null || _c === void 0 ? void 0 : _c.split(' ')[0]) === null || _d === void 0 ? void 0 : _d.substring(1)) || '';
                    yield (0, storage_1.trackAnalyticsEvent)('command_used', msg.chat.id, { command });
                }
            }
            catch (error) {
                console.error('Error tracking user interaction:', error);
            }
        }));
        // Set up callbacks for inline keyboards
        const callbacks = Object.assign(Object.assign({}, connect_wallet_menu_1.walletMenuCallbacks), { back_to_menu: commands_handlers_1.handleBackToMenuCallback, tutorial_next: (query) => { (0, tutorial_system_1.handleTutorialCallback)(query, 'tutorial_next'); }, tutorial_back: (query) => { (0, tutorial_system_1.handleTutorialCallback)(query, 'tutorial_back'); }, tutorial_skip: (query) => { (0, tutorial_system_1.handleTutorialCallback)(query, 'tutorial_skip'); }, restart_tutorial: (query) => { (0, tutorial_system_1.handleTutorialCallback)(query, 'restart_tutorial'); }, cancel_tutorial: (query) => { (0, tutorial_system_1.handleTutorialCallback)(query, 'cancel_tutorial'); } });
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
            let request;
            try {
                request = JSON.parse(query.data);
            }
            catch (_e) {
                return;
            }
            if (!callbacks[request.method]) {
                return;
            }
            callbacks[request.method](query, request.data);
        }));
        // Register traditional command handlers
        bot_1.bot.onText(/\/connect/, commands_handlers_1.handleConnectCommand);
        bot_1.bot.onText(/\/send_tx/, commands_handlers_1.handleSendTXCommand);
        bot_1.bot.onText(/\/disconnect/, commands_handlers_1.handleDisconnectCommand);
        bot_1.bot.onText(/\/my_wallet/, commands_handlers_1.handleShowMyWalletCommand);
        bot_1.bot.onText(/\/funding/, commands_handlers_1.handleFundingCommand);
        bot_1.bot.onText(/\/users/, commands_handlers_1.handleUsersCommand);
        bot_1.bot.onText(/\/info/, commands_handlers_1.handleInfoCommand);
        bot_1.bot.onText(/\/support/, commands_handlers_1.handleSupportCommand);
        bot_1.bot.onText(/\/pay_now/, commands_handlers_1.handlePayNowCommand);
        bot_1.bot.onText(/\/approve/, commands_handlers_1.handleApproveCommand);
        bot_1.bot.onText(/\/reject/, commands_handlers_1.handleRejectCommand);
        bot_1.bot.onText(/\/withdraw/, commands_handlers_1.handleWithdrawCommand);
        // Register new commands
        bot_1.bot.onText(/\/tutorial/, tutorial_system_1.handleTutorialCommand);
        bot_1.bot.onText(/\/skip/, tutorial_system_1.handleSkipCommand);
        bot_1.bot.onText(/\/errors (.+)?/, error_handler_1.handleErrorsCommand);
        bot_1.bot.onText(/\/analytics/, (msg) => new analytics_command_1.AnalyticsCommand().handler(msg));
        bot_1.bot.onText(/\/schedule (.+)?/, scheduled_messages_1.handleScheduleCommand);
        bot_1.bot.onText(/\/cancel_schedule (.+)?/, scheduled_messages_1.handleCancelScheduleCommand);
        bot_1.bot.onText(/\/list_scheduled/, scheduled_messages_1.handleListScheduledCommand);
        bot_1.bot.onText(/\/start/, (msg) => __awaiter(this, void 0, void 0, function* () {
            var _f;
            const chatId = msg.chat.id;
            const userIsAdmin = (0, utils_1.isAdmin)(chatId);
            // Get the user's display name
            const userDisplayName = ((_f = msg.from) === null || _f === void 0 ? void 0 : _f.first_name) || 'Valued User';
            // Track analytics for start command
            yield (0, storage_1.trackAnalyticsEvent)('start_command', chatId);
            const baseMessage = `🎉 Welcome to Sukuk Trading App, ${userDisplayName}!

Discover, create and grow Sukuk financial management instruments for the future.

*User Commands:*
/connect - Connect to a wallet
/my_wallet - Show connected wallet
/send_tx - Send transaction (100 TON)
/funding [amount] - Custom transaction amount
/pay_now [transaction_id] - Submit transaction ID
/withdraw - Access withdrawal portal
/disconnect - Disconnect wallet
/support [message] - Get live support
/info - Help & recommendations
/tutorial - Interactive walkthrough guide
/skip - Skip the tutorial`;
            const adminCommands = `

*Admin Commands:*
/users - View connected users
/pay_now - View pending transactions
/approve [transaction_id] - Approve transaction
/reject [transaction_id] - Reject transaction
/errors [limit] - View recent errors
/analytics - View usage statistics
/schedule - Schedule broadcast message
/list_scheduled - View pending scheduled messages
/cancel_schedule [id] - Cancel scheduled message`;
            const footer = `

Homepage: https://dlb-sukuk.22web.org`;
            const message = userIsAdmin ? baseMessage + adminCommands + footer : baseMessage + footer;
            yield bot_1.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            // For new users, offer to start tutorial
            const userData = yield (0, storage_1.getUserData)(chatId);
            if (userData && !userData.walletEverConnected) {
                setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                    const keyboard = {
                        inline_keyboard: [[
                                { text: 'Start Tutorial', callback_data: JSON.stringify({ method: 'restart_tutorial', data: '' }) }
                            ]]
                    };
                    yield bot_1.bot.sendMessage(chatId, 'Would you like to take a quick tutorial to learn how to use this bot?', { reply_markup: keyboard });
                }), 1000); // Small delay for better UX
            }
        }));
        // Initialize inline mode capabilities
        (0, inline_capabilities_1.setupInlineHandler)();
        // Set up scheduled messages processor
        (0, scheduled_messages_1.setupScheduledMessagesProcessor)();
        // Register commands with Telegram for autocomplete suggestions
        try {
            yield bot_1.bot.setMyCommands([
                { command: 'start', description: 'Start the bot' },
                { command: 'connect', description: 'Connect your TON wallet' },
                { command: 'my_wallet', description: 'View your connected wallet' },
                { command: 'send_tx', description: 'Send transaction (100 TON)' },
                { command: 'funding', description: 'Custom transaction amount' },
                { command: 'pay_now', description: 'Submit transaction ID' },
                { command: 'withdraw', description: 'Access withdrawal portal' },
                { command: 'disconnect', description: 'Disconnect wallet' },
                { command: 'support', description: 'Get live support' },
                { command: 'info', description: 'Help & recommendations' },
                { command: 'tutorial', description: 'Interactive walkthrough guide' },
                { command: 'skip', description: 'Skip the tutorial' }
            ]);
            console.log('Command list updated in Telegram');
        }
        catch (error) {
            console.error('Failed to register commands with Telegram:', error);
        }
        console.log('TON Connect Telegram Bot initialized and ready!');
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