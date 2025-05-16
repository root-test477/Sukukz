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
exports.ErrorHandler = exports.ErrorType = void 0;
const bot_1 = require("./bot");
const utils_1 = require("./utils");
/**
 * Types of errors that can occur in the bot
 */
var ErrorType;
(function (ErrorType) {
    ErrorType["COMMAND_HANDLER"] = "command_handler";
    ErrorType["CALLBACK_HANDLER"] = "callback_handler";
    ErrorType["WALLET_CONNECTION"] = "wallet_connection";
    ErrorType["REDIS_STORAGE"] = "redis_storage";
    ErrorType["TRANSACTION"] = "transaction";
    ErrorType["GENERAL"] = "general";
    ErrorType["UNKNOWN"] = "unknown"; // Added for undefined error types
})(ErrorType = exports.ErrorType || (exports.ErrorType = {}));
/**
 * Class to handle all errors in the bot and prevent crashes
 */
class ErrorHandler {
    /**
     * Wraps a command handler in a try-catch block
     * @param handler The command handler function
     * @returns A wrapped handler that won't crash the bot
     */
    static wrapCommandHandler(handler, command) {
        return (...args) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                yield handler(...args);
            }
            catch (error) {
                // Get the message and chat ID from the first argument if available
                let chatId;
                let userId;
                if (args.length > 0 && args[0] && 'chat' in args[0]) {
                    const msg = args[0];
                    chatId = msg.chat.id;
                    userId = (_a = msg.from) === null || _a === void 0 ? void 0 : _a.id;
                }
                // Log the error
                this.handleError({
                    type: ErrorType.COMMAND_HANDLER,
                    message: error instanceof Error ? error.message : String(error),
                    command,
                    userId,
                    timestamp: Date.now(),
                    stack: error instanceof Error ? error.stack : undefined
                });
                // Send error message to user if chat ID is available
                if (chatId) {
                    yield bot_1.bot.sendMessage(chatId, `⚠️ Sorry, an error occurred while processing the /${command} command. Please try again later.`);
                }
            }
        });
    }
    /**
     * Wraps a callback query handler in a try-catch block
     * @param handler The callback query handler function
     * @param method The callback method name
     * @returns A wrapped handler that won't crash the bot
     */
    static wrapCallbackHandler(handler, method) {
        return (...args) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                yield handler(...args);
            }
            catch (error) {
                // Get the chat ID from the first argument if available
                let chatId;
                let userId;
                if (args.length > 0 && args[0] && 'from' in args[0]) {
                    const query = args[0];
                    chatId = (_a = query.message) === null || _a === void 0 ? void 0 : _a.chat.id;
                    userId = (_b = query.from) === null || _b === void 0 ? void 0 : _b.id;
                }
                // Log the error
                this.handleError({
                    type: ErrorType.CALLBACK_HANDLER,
                    message: error instanceof Error ? error.message : String(error),
                    command: method,
                    userId,
                    timestamp: Date.now(),
                    stack: error instanceof Error ? error.stack : undefined
                });
                // Answer the callback query to prevent the loading spinner
                if (args.length > 0 && args[0] && 'id' in args[0]) {
                    const query = args[0];
                    try {
                        yield bot_1.bot.answerCallbackQuery(query.id, {
                            text: "An error occurred. Please try again."
                        });
                    }
                    catch (e) {
                        // Ignore errors when answering the callback query
                    }
                }
                // Send error message to user if chat ID is available
                if (chatId) {
                    yield bot_1.bot.sendMessage(chatId, `⚠️ Sorry, an error occurred while processing your request. Please try again later.`);
                }
            }
        });
    }
    /**
     * Handle a general error
     * @param errorDetails Error details to log
     */
    static handleError(errorDetails) {
        console.error(`[ERROR] ${errorDetails.type}: ${errorDetails.message}`);
        if (errorDetails.stack) {
            console.error(errorDetails.stack);
        }
        // Save the error to the in-memory log
        this.errors.unshift(errorDetails);
        if (this.errors.length > this.MAX_ERRORS) {
            this.errors.pop(); // Remove the oldest error
        }
    }
    /**
     * Get the most recent errors
     * @param limit Maximum number of errors to return
     * @returns List of recent errors
     */
    static getRecentErrors(limit = 10) {
        return this.errors.slice(0, limit);
    }
    /**
     * Send error report to admin(s)
     * @param chatId Admin chat ID to send the report to
     * @param limit Number of recent errors to include
     */
    static sendErrorReport(chatId, limit = 10) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(0, utils_1.isAdmin)(chatId)) {
                yield bot_1.bot.sendMessage(chatId, "⚠️ Sorry, this command is only available to administrators.");
                return;
            }
            const recentErrors = ErrorHandler.getRecentErrors(limit);
            if (recentErrors.length === 0) {
                yield bot_1.bot.sendMessage(chatId, "✅ No errors have been recorded!");
                return;
            }
            let message = `📊 Recent Error Report (Last ${recentErrors.length}):\n\n`;
            for (let i = 0; i < recentErrors.length; i++) {
                const error = recentErrors[i];
                if (!error)
                    continue; // Skip if error is undefined
                const date = new Date(error.timestamp).toLocaleString();
                const errorType = error.type || ErrorType.UNKNOWN;
                const userId = error.userId || 'Unknown';
                const errorMessage = error.message || 'No message';
                const commandStr = error.command ? ` (/${error.command})` : '';
                message += `${i + 1}. ${errorType}${commandStr}\n`
                    + `   Time: ${date}\n`
                    + `   User: ${userId}\n`
                    + `   Message: ${errorMessage}\n\n`;
            }
            yield bot_1.bot.sendMessage(chatId, message);
        });
    }
    /**
     * Register the /errors command for admins
     * This should be called during initialization
     */
    static registerErrorReportCommand() {
        bot_1.bot.onText(/\/errors(?:\s+(\d+))?/, (msg, match) => __awaiter(this, void 0, void 0, function* () {
            try {
                const chatId = msg.chat.id;
                let limit = 10; // Default limit
                // Parse limit from command if provided
                if (match && match[1]) {
                    const parsedLimit = parseInt(match[1], 10);
                    if (!isNaN(parsedLimit) && parsedLimit > 0) {
                        limit = Math.min(parsedLimit, 50); // Cap at 50 errors
                    }
                }
                yield ErrorHandler.sendErrorReport(chatId, limit);
            }
            catch (error) {
                console.error('Error in error report command:', (error === null || error === void 0 ? void 0 : error.message) || error);
            }
        }));
    }
}
exports.ErrorHandler = ErrorHandler;
ErrorHandler.errors = [];
ErrorHandler.MAX_ERRORS = 100; // Maximum number of errors to keep in memory
//# sourceMappingURL=error-handler.js.map