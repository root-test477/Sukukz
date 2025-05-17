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
exports.safeSendMessage = exports.sendErrorReport = exports.withErrorBoundary = void 0;
const bot_1 = require("./bot");
const utils_1 = require("./utils");
const storage_1 = require("./ton-connect/storage");
const error_types_1 = require("./error-types");
/**
 * Error boundary wrapper for bot command handlers
 * Prevents errors in individual commands from crashing the entire bot
 *
 * @param handler The original command handler function
 * @returns A wrapped function that catches errors
 */
function withErrorBoundary(handler) {
    return (...args) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            yield handler(...args);
        }
        catch (error) {
            console.error(`Error in command handler: ${error instanceof Error ? error.message : error}`);
            console.error(error);
            // Convert to BotError if it's not already
            const botError = error instanceof error_types_1.BotError
                ? error
                : error_types_1.BotError.fromError(error instanceof Error ? error : new Error(String(error)), error_types_1.ErrorType.COMMAND_ERROR);
            // Save error report to Redis
            try {
                yield (0, storage_1.saveErrorReport)(botError.toObject());
            }
            catch (saveError) {
                console.error('Failed to save error report:', saveError);
            }
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
                    // Send a user-friendly error message
                    yield bot_1.bot.sendMessage(chatId, "⚠️ There was a problem processing your request. Please try again later.");
                    // Notify admin(s) about the error
                    yield sendErrorReport(botError, chatId, ((_a = args[0]) === null || _a === void 0 ? void 0 : _a.text) || 'Unknown');
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
/**
 * Send error report to administrators
 * @param error The error object
 * @param userId The user ID who triggered the error
 * @param command The command that caused the error
 */
function sendErrorReport(error, userId, command) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const adminIds = ((_a = process.env.ADMIN_IDS) === null || _a === void 0 ? void 0 : _a.split(',').map(id => Number(id.trim()))) || [];
        if (adminIds.length === 0)
            return;
        const botError = error instanceof error_types_1.BotError
            ? error
            : error_types_1.BotError.fromError(error, error_types_1.ErrorType.UNKNOWN_ERROR, userId, command);
        // Update user ID and command if provided
        if (userId && !botError.userId)
            botError.userId = userId;
        if (command && !botError.command)
            botError.command = command;
        const errorDetails = `
🔴 *Bot Error Report*

*Error Type*: ${botError.type || 'Unknown'}
*Message*: ${botError.message}
*User ID*: ${botError.userId || 'Unknown'}
*Command*: ${botError.command || 'Unknown'}
*Time*: ${new Date(botError.timestamp).toISOString()}`;
        for (const adminId of adminIds) {
            try {
                if (adminId !== botError.userId || (botError.userId && (0, utils_1.isAdmin)(botError.userId))) {
                    yield bot_1.bot.sendMessage(adminId, errorDetails, { parse_mode: 'Markdown' });
                }
            }
            catch (notifyError) {
                console.error(`Failed to notify admin ${adminId} about error:`, notifyError);
            }
        }
    });
}
exports.sendErrorReport = sendErrorReport;
/**
 * Safe message sender that handles Markdown parsing errors
 * If sending with Markdown fails, it will retry without Markdown
 */
function safeSendMessage(chatId, text, options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield bot_1.bot.sendMessage(chatId, text, options);
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
                return yield bot_1.bot.sendMessage(chatId, text + "\n\n(Note: Some formatting was removed due to technical issues)", safeOptions);
            }
            // If it's another kind of error, rethrow it
            throw error;
        }
    });
}
exports.safeSendMessage = safeSendMessage;
//# sourceMappingURL=error-boundary.js.map