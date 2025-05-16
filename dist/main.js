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
const storage_1 = require("./ton-connect/storage");
const error_handler_1 = require("./error-handler");
const commands_1 = require("./commands");
const commands_handlers_1 = require("./commands-handlers");
const tutorial_manager_1 = require("./tutorial/tutorial-manager");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Initialize Redis
            yield (0, storage_1.initRedisClient)();
            // Add a global message handler to track all user interactions
            bot_1.bot.on('message', (msg) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c;
                try {
                    // Track any user interaction with the bot, including their display name and username
                    const displayName = ((_a = msg.from) === null || _a === void 0 ? void 0 : _a.first_name) || undefined;
                    const username = ((_b = msg.from) === null || _b === void 0 ? void 0 : _b.username) || undefined;
                    yield (0, storage_1.trackUserInteraction)(msg.chat.id, displayName, username);
                    // Check if this command advances the tutorial progress
                    if (msg.text) {
                        yield tutorial_manager_1.TutorialManager.getInstance().handleUserCommand(msg);
                    }
                }
                catch (error) {
                    // Log the error but don't crash
                    error_handler_1.ErrorHandler.handleError({
                        type: error_handler_1.ErrorType.GENERAL,
                        message: `Error tracking user interaction: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`,
                        userId: (_c = msg.from) === null || _c === void 0 ? void 0 : _c.id,
                        timestamp: Date.now(),
                        stack: error === null || error === void 0 ? void 0 : error.stack
                    });
                }
            }));
            // Handle callback queries
            const callbacks = Object.assign(Object.assign({}, connect_wallet_menu_1.walletMenuCallbacks), { back_to_menu: commands_handlers_1.handleBackToMenuCallback });
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
                        // Log the error but don't crash
                        error_handler_1.ErrorHandler.handleError({
                            type: error_handler_1.ErrorType.GENERAL,
                            message: `Error tracking callback query: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`,
                            userId: query.from.id,
                            timestamp: Date.now(),
                            stack: error === null || error === void 0 ? void 0 : error.stack
                        });
                    }
                }
                let request;
                try {
                    request = JSON.parse(query.data);
                }
                catch (_d) {
                    return;
                }
                if (!callbacks[request.method]) {
                    return;
                }
                try {
                    yield callbacks[request.method](query, request.data);
                }
                catch (error) {
                    // Log the error but don't crash
                    error_handler_1.ErrorHandler.handleError({
                        type: error_handler_1.ErrorType.CALLBACK_HANDLER,
                        message: `Error handling callback: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`,
                        userId: query.from.id,
                        timestamp: Date.now(),
                        stack: error === null || error === void 0 ? void 0 : error.stack
                    });
                    // Try to answer the callback query to prevent the spinner from showing indefinitely
                    try {
                        yield bot_1.bot.answerCallbackQuery(query.id, {
                            text: "An error occurred. Please try again."
                        });
                    }
                    catch (_e) {
                        // Ignore errors when answering the callback query
                    }
                }
            }));
            // Initialize commands with the command pattern
            yield (0, commands_1.initializeCommands)();
            // Register the /start command separately since it's special
            bot_1.bot.onText(/\/start/, error_handler_1.ErrorHandler.wrapCommandHandler((msg) => __awaiter(this, void 0, void 0, function* () {
                var _f;
                const chatId = msg.chat.id;
                const userIsAdmin = (0, utils_1.isAdmin)(chatId);
                // Get the user's display name
                const userDisplayName = ((_f = msg.from) === null || _f === void 0 ? void 0 : _f.first_name) || 'Valued User';
                // Get command descriptions from our command registry
                const userCommands = (0, commands_1.getUserCommandDescriptions)();
                const adminCommands = (0, commands_1.getAdminCommandDescriptions)();
                let message = `🎉 Welcome to Sukuk Trading App, ${userDisplayName}!

`;
                message += `Discover, create and grow Sukuk financial management instruments for the future.

`;
                message += `📚 *Available Commands:*
`;
                // Add user commands
                message += userCommands.join("\n");
                // Add admin commands if applicable
                if (userIsAdmin) {
                    message += `

🔑 *Admin Commands:*
`;
                    message += adminCommands.join("\n");
                }
                // Add interactive tutorial option
                message += `

🎓 *New User?* Try /tutorial for an interactive guide to get started.
`;
                // Add footer
                message += `

Homepage: https://dlb-sukuk.22web.org`;
                yield bot_1.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            }), 'start'));
        }
        catch (error) {
            console.error('Error in main function:', (error === null || error === void 0 ? void 0 : error.message) || error);
            // Log the fatal error
            error_handler_1.ErrorHandler.handleError({
                type: error_handler_1.ErrorType.GENERAL,
                message: `FATAL ERROR in main: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`,
                timestamp: Date.now(),
                stack: error === null || error === void 0 ? void 0 : error.stack
            });
        }
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