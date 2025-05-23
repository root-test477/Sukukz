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
exports.safeSendMessage = exports.withErrorBoundary = void 0;
const bot_factory_1 = require("./bot-factory");
const utils_1 = require("./utils");
/**
 * Error boundary wrapper for bot command handlers
 * Prevents errors in individual commands from crashing the entire bot
 *
 * @param handler The original command handler function
 * @returns A wrapped function that catches errors
 */
function withErrorBoundary(handler) {
    return (...args) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            yield handler(...args);
        }
        catch (error) {
            console.error(`Error in command handler: ${error instanceof Error ? error.message : error}`);
            console.error(error);
            // Try to extract chatId from the arguments (assuming first arg is Message or CallbackQuery)
            let chatId;
            if (args.length > 0) {
                const firstArg = args[0];
                if (firstArg && typeof firstArg === 'object') {
                    // For normal messages
                    if ('chat' in firstArg && firstArg.chat && 'id' in firstArg.chat) {
                        chatId = firstArg.chat.id;
                    }
                    // For callback queries
                    else if ('message' in firstArg &&
                        firstArg.message &&
                        'chat' in firstArg.message &&
                        firstArg.message.chat &&
                        'id' in firstArg.message.chat) {
                        chatId = firstArg.message.chat.id;
                    }
                }
            }
            if (chatId) {
                try {
                    // Extract botId from args if possible (assuming it's the second argument for most handlers)
                    let botId = 'default';
                    if (args.length > 1 && typeof args[1] === 'string') {
                        botId = args[1];
                    }
                    // Get the bot instance for this botId
                    const botFactory = bot_factory_1.BotFactory.getInstance();
                    const bot = botFactory.getBot(botId);
                    if (!bot) {
                        console.error(`Bot with ID ${botId} not found in error boundary`);
                        return;
                    }
                    // Send a user-friendly error message
                    yield bot.sendMessage(chatId, "⚠️ There was a problem processing your request. Please try again later.");
                    // Notify admin(s) about the error
                    const adminIds = ((_a = process.env.ADMIN_IDS) === null || _a === void 0 ? void 0 : _a.split(',').map(id => Number(id.trim()))) || [];
                    if (adminIds.length > 0) {
                        const errorDetails = `
🔴 *Bot Error Report*

*Error Type*: ${error instanceof Error ? error.name : 'Unknown'}
*Message*: ${error instanceof Error ? error.message : String(error)}
*User ID*: ${chatId}
*Command*: ${((_b = args[0]) === null || _b === void 0 ? void 0 : _b.text) || 'Unknown'}
*Time*: ${new Date().toISOString()}`;
                        for (const adminId of adminIds) {
                            try {
                                if (adminId !== chatId || (0, utils_1.isAdmin)(chatId, botId)) {
                                    if (bot) {
                                        yield bot.sendMessage(adminId, errorDetails, { parse_mode: 'Markdown' });
                                    }
                                }
                            }
                            catch (notifyError) {
                                console.error(`Failed to notify admin ${adminId} about error:`, notifyError);
                            }
                        }
                    }
                }
                catch (sendError) {
                    console.error('Error sending error notification:', sendError);
                }
            }
        }
    });
}
exports.withErrorBoundary = withErrorBoundary;
/**
 * Safe message sender that handles Markdown parsing errors
 * If sending with Markdown fails, it will retry without Markdown
 */
function safeSendMessage(chatId, text, options, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Get the bot instance
        const botFactory = bot_factory_1.BotFactory.getInstance();
        let bot;
        if (botId) {
            bot = botFactory.getBot(botId);
        }
        else {
            // If no specific botId provided, get the first bot from the factory
            const bots = botFactory.getAllBots();
            if (bots.size > 0) {
                bot = bots.values().next().value;
            }
        }
        if (!bot) {
            throw new Error(`No bot available for sending message${botId ? ` (botId: ${botId})` : ''}`);
        }
        try {
            return yield bot.sendMessage(chatId, text, options);
        }
        catch (error) {
            if (error &&
                typeof error === 'object' &&
                'message' in error &&
                typeof error.message === 'string' &&
                error.message.includes('parse entities')) {
                console.warn('Markdown parsing error, retrying without markdown formatting');
                // Try again without markdown parsing
                const safeOptions = Object.assign({}, options);
                if (safeOptions.parse_mode) {
                    delete safeOptions.parse_mode;
                }
                // Add a note about formatting
                return yield bot.sendMessage(chatId, text + "\n\n(Note: Some formatting was removed due to technical issues)", safeOptions);
            }
            // If it's another kind of error, rethrow it
            throw error;
        }
    });
}
exports.safeSendMessage = safeSendMessage;
//# sourceMappingURL=error-boundary.js.map