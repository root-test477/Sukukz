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
exports.handleErrorsCommand = exports.setupGlobalErrorHandlers = exports.withErrorHandling = exports.ErrorHandler = exports.ErrorType = void 0;
const bot_1 = require("./bot");
const storage_1 = require("./ton-connect/storage");
// Error type enum for categorizing errors
var ErrorType;
(function (ErrorType) {
    ErrorType["GENERAL"] = "general";
    ErrorType["COMMAND_HANDLER"] = "command_handler";
    ErrorType["WALLET_CONNECTION"] = "wallet_connection";
    ErrorType["REDIS_STORAGE"] = "redis_storage";
    ErrorType["TRANSACTION"] = "transaction";
    ErrorType["API_INTEGRATION"] = "api_integration";
    ErrorType["COMMAND_ERROR"] = "command_error";
    ErrorType["CONNECTION_ERROR"] = "connection_error";
    ErrorType["STORAGE_ERROR"] = "storage_error";
    ErrorType["VALIDATION_ERROR"] = "validation_error";
    ErrorType["UNKNOWN_ERROR"] = "unknown_error";
})(ErrorType = exports.ErrorType || (exports.ErrorType = {}));
/**
 * Error handler class with static methods
 */
class ErrorHandler {
    /**
     * Handle an error with the specified error type
     */
    static handleError(error, errorType = ErrorType.GENERAL, context) {
        return __awaiter(this, void 0, void 0, function* () {
            // Generate a unique error ID
            const errorId = generateErrorId();
            // Log the error
            this.logError(error, errorType, context);
            // Save error report to Redis
            yield (0, storage_1.saveErrorReport)(errorId, error, errorType, context);
            return errorId;
        });
    }
    /**
     * Log an error to the console
     */
    static logError(error, errorType = ErrorType.GENERAL, context) {
        console.error(`[${errorType}] Error:`, error);
        if (context) {
            console.error('Context:', context);
        }
    }
}
exports.ErrorHandler = ErrorHandler;
/**
 * Global error handler for command execution
 * Wraps command handlers to prevent crashes and log errors
 */
function withErrorHandling(handler, commandName) {
    return (msg, ...args) => __awaiter(this, void 0, void 0, function* () {
        try {
            yield handler(msg, ...args);
        }
        catch (error) {
            const chatId = msg.chat.id;
            const errorId = generateErrorId();
            console.error(`Error in ${commandName} [ErrorID: ${errorId}]:`, error);
            // Save error using ErrorHandler
            try {
                yield ErrorHandler.handleError(error, ErrorType.COMMAND_HANDLER, {
                    commandName,
                    userId: chatId,
                    message: msg.text || ''
                });
            }
            catch (storageError) {
                console.error('Failed to save error report:', storageError);
            }
            // Send user-friendly error message
            yield bot_1.bot.sendMessage(chatId, `⚠️ Something went wrong while processing your request.
                
Error ID: ${errorId}
                
Our team has been notified. If this issue persists, please contact support with this Error ID.`);
        }
    });
}
exports.withErrorHandling = withErrorHandling;
/**
 * Handle uncaught exceptions and unhandled rejections at process level
 */
function setupGlobalErrorHandlers() {
    process.on('uncaughtException', (error) => {
        console.error('UNCAUGHT EXCEPTION:', error);
        // Log to a monitoring service or file if needed
    });
    process.on('unhandledRejection', (reason) => {
        console.error('UNHANDLED REJECTION:', reason);
        // Log to a monitoring service or file if needed
    });
}
exports.setupGlobalErrorHandlers = setupGlobalErrorHandlers;
/**
 * Generate a unique error ID for tracking
 */
function generateErrorId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}
/**
 * Handler for the /errors command (admin-only)
 * Retrieves recent error reports
 */
function handleErrorsCommand(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Safely extract limit parameter with a default value
        const messageText = msg.text || '/errors 10';
        const limitStr = messageText.split(' ')[1] || '10';
        const limit = parseInt(limitStr, 10);
        try {
            const redisClient = yield (0, storage_1.getRedisClient)();
            // Get error IDs from Redis, sorted by time (newest first)
            const errorIds = yield redisClient.zRange('error_reports', 0, -1, { REV: true });
            if (!errorIds || errorIds.length === 0) {
                yield bot_1.bot.sendMessage(chatId, '📊 No errors have been reported.');
                return;
            }
            // Get the most recent error reports
            const recentErrorIds = errorIds.slice(0, limit);
            const errorReports = [];
            for (const errorId of recentErrorIds) {
                const errorData = yield redisClient.hGetAll(`error:${errorId || ''}`);
                if (Object.keys(errorData).length > 0) {
                    errorReports.push({
                        id: errorId,
                        timestamp: errorData.timestamp || '',
                        commandName: errorData.commandName || '',
                        userId: parseInt(errorData.userId || '0') || 0,
                        userMessage: errorData.userMessage || '',
                        error: errorData.error || '',
                        stack: errorData.stack || ''
                    });
                }
            }
            // Format and send report
            let responseText = `📊 *Recent Error Reports* (Last ${Math.min(limit, errorReports.length)})

`;
            for (const report of errorReports) {
                const date = new Date(report.timestamp);
                const formattedDate = date.toLocaleString();
                responseText += `🆔 *Error ID:* ${report.id}\n`;
                responseText += `⏰ *Time:* ${formattedDate}\n`;
                responseText += `🤖 *Command:* ${report.commandName}\n`;
                responseText += `👤 *User ID:* ${report.userId}\n`;
                responseText += `💬 *User Input:* ${report.userMessage || 'N/A'}\n`;
                responseText += `❌ *Error:* ${report.error}\n\n`;
            }
            yield bot_1.bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
        }
        catch (error) {
            console.error('Error fetching error reports:', error);
            yield bot_1.bot.sendMessage(chatId, 'Failed to retrieve error reports.');
        }
    });
}
exports.handleErrorsCommand = handleErrorsCommand;
//# sourceMappingURL=error-handler.js.map