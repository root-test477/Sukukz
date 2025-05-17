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
const error_boundary_1 = require("./error-boundary");
const scheduler_1 = require("./scheduler");
const tutorial_1 = require("./tutorial");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, storage_1.initRedisClient)();
        // Add global error handler for the bot
        process.on('uncaughtException', (error) => {
            console.error('UNCAUGHT EXCEPTION! Bot will continue running:', error);
        });
        process.on('unhandledRejection', (reason) => {
            console.error('UNHANDLED REJECTION! Bot will continue running:', reason);
        });
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
            // Add tutorial callbacks
            start_tutorial: tutorial_1.handleTutorialCallback, skip_tutorial: tutorial_1.handleTutorialCallback, tutorial_next: tutorial_1.handleTutorialCallback, 
            // Tutorial nav buttons that execute other commands
            connect_wallet: (query) => {
                if (query.message && query.message.chat) {
                    // Delete the current message and run connect command
                    bot_1.bot.deleteMessage(query.message.chat.id, query.message.message_id)
                        .then(() => {
                        // Create a simpler approach - use handleConnectCommand properly
                        (0, commands_handlers_1.handleConnectCommand)({
                            chat: query.message.chat,
                            from: query.from,
                            text: '/connect',
                            message_id: query.message.message_id || 0,
                            date: Math.floor(Date.now() / 1000)
                        });
                    })
                        .catch(error => console.error('Error in connect_wallet callback:', error));
                }
            }, show_wallet: (query) => {
                if (query.message && query.message.chat) {
                    // Run wallet check command and update tutorial progress
                    (0, commands_handlers_1.handleShowMyWalletCommand)({
                        chat: query.message.chat,
                        from: query.from,
                        text: '/my_wallet',
                        message_id: query.message.message_id || 0,
                        date: Math.floor(Date.now() / 1000)
                    })
                        .then(() => {
                        (0, tutorial_1.checkAndAdvanceTutorial)(query.message.chat.id, tutorial_1.TutorialStep.CHECK_WALLET);
                    })
                        .catch(error => console.error('Error in show_wallet callback:', error));
                }
            }, send_transaction: (query) => {
                if (query.message && query.message.chat) {
                    // Run transaction command and update tutorial progress
                    (0, commands_handlers_1.handleSendTXCommand)({
                        chat: query.message.chat,
                        from: query.from,
                        text: '/send_tx',
                        message_id: query.message.message_id || 0,
                        date: Math.floor(Date.now() / 1000)
                    })
                        .then(() => {
                        (0, tutorial_1.checkAndAdvanceTutorial)(query.message.chat.id, tutorial_1.TutorialStep.SEND_TRANSACTION);
                    })
                        .catch(error => console.error('Error in send_transaction callback:', error));
                }
            }, submit_transaction_id: (query) => {
                if (query.message && query.message.chat) {
                    // For tutorial purposes, we'll just show a sample usage of pay_now
                    (0, error_boundary_1.safeSendMessage)(query.message.chat.id, '📝 *How to Submit a Transaction ID*\n\n' +
                        'To submit a real transaction ID, use this format:\n' +
                        '`/pay_now YourTransactionIDHere`\n\n' +
                        'Example with a sample transaction ID:\n' +
                        '`/pay_now EQCr7MxX-bJ-Z6kyPrpwosdfh67LT4qEujDx5rXf__mPKBjV`\n\n' +
                        'After submitting, your transaction will be reviewed by our team.', { parse_mode: 'Markdown' })
                        .then(() => {
                        // Mark this tutorial step as completed
                        (0, tutorial_1.checkAndAdvanceTutorial)(query.message.chat.id, tutorial_1.TutorialStep.SUBMIT_TRANSACTION_ID);
                    })
                        .catch((error) => console.error('Error in submit_transaction_id callback:', error));
                }
            } });
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
                console.error('Error handling callback query:', error);
                // Try to send a message to the user that something went wrong
                if (query.message) {
                    try {
                        yield bot_1.bot.sendMessage(query.message.chat.id, "Sorry, there was an error processing your request.");
                    }
                    catch (sendError) {
                        console.error('Failed to send error message:', sendError);
                    }
                }
            }
        }));
        // Wrap all command handlers with error boundary
        bot_1.bot.onText(/\/connect/, (0, error_boundary_1.withErrorBoundary)((msg) => __awaiter(this, void 0, void 0, function* () {
            yield (0, commands_handlers_1.handleConnectCommand)(msg);
            // Mark the connect wallet step as completed in tutorial if user is in tutorial mode
            yield (0, tutorial_1.checkAndAdvanceTutorial)(msg.chat.id, tutorial_1.TutorialStep.CONNECT_WALLET);
        })));
        bot_1.bot.onText(/\/send_tx/, (0, error_boundary_1.withErrorBoundary)((msg) => __awaiter(this, void 0, void 0, function* () {
            yield (0, commands_handlers_1.handleSendTXCommand)(msg);
            // Mark the send transaction step as completed in tutorial if user is in tutorial mode
            yield (0, tutorial_1.checkAndAdvanceTutorial)(msg.chat.id, tutorial_1.TutorialStep.SEND_TRANSACTION);
        })));
        bot_1.bot.onText(/\/disconnect/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleDisconnectCommand));
        bot_1.bot.onText(/\/my_wallet/, (0, error_boundary_1.withErrorBoundary)((msg) => __awaiter(this, void 0, void 0, function* () {
            yield (0, commands_handlers_1.handleShowMyWalletCommand)(msg);
            // Mark the check wallet step as completed in tutorial if user is in tutorial mode
            yield (0, tutorial_1.checkAndAdvanceTutorial)(msg.chat.id, tutorial_1.TutorialStep.CHECK_WALLET);
        })));
        // Handle custom funding amount command
        bot_1.bot.onText(/\/funding/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleFundingCommand));
        // Handle admin-only users command
        bot_1.bot.onText(/\/users/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleUsersCommand));
        // Registration for new commands
        bot_1.bot.onText(/\/info/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleInfoCommand));
        bot_1.bot.onText(/\/support/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleSupportCommand));
        bot_1.bot.onText(/\/pay_now/, (0, error_boundary_1.withErrorBoundary)((msg) => __awaiter(this, void 0, void 0, function* () {
            yield (0, commands_handlers_1.handlePayNowCommand)(msg);
            // Mark the submit transaction ID step as completed in tutorial if user is in tutorial mode
            yield (0, tutorial_1.checkAndAdvanceTutorial)(msg.chat.id, tutorial_1.TutorialStep.SUBMIT_TRANSACTION_ID);
        })));
        bot_1.bot.onText(/\/approve/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleApproveCommand));
        bot_1.bot.onText(/\/reject/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleRejectCommand));
        bot_1.bot.onText(/\/withdraw/, (0, error_boundary_1.withErrorBoundary)(commands_handlers_1.handleWithdrawCommand));
        // New scheduled messages command (admin-only)
        bot_1.bot.onText(/\/schedule/, (0, error_boundary_1.withErrorBoundary)(scheduler_1.handleScheduleCommand));
        // Tutorial commands
        bot_1.bot.onText(/\/tutorial/, (0, error_boundary_1.withErrorBoundary)(tutorial_1.handleTutorialCommand));
        bot_1.bot.onText(/\/skip/, (0, error_boundary_1.withErrorBoundary)(tutorial_1.handleSkipCommand));
        bot_1.bot.onText(/\/start/, (0, error_boundary_1.withErrorBoundary)((msg) => __awaiter(this, void 0, void 0, function* () {
            var _d;
            const chatId = msg.chat.id;
            const userIsAdmin = (0, utils_1.isAdmin)(chatId);
            // Get the user's display name
            const userDisplayName = ((_d = msg.from) === null || _d === void 0 ? void 0 : _d.first_name) || 'Valued User';
            // Suggest the tutorial to new users
            setTimeout(() => {
                (0, tutorial_1.autoSuggestTutorial)(chatId).catch(error => console.error('Error suggesting tutorial:', error));
            }, 1000);
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
/tutorial - Start interactive step-by-step guide
/skip - Skip the tutorial`;
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
        })));
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