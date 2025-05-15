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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeExecute = exports.ErrorHandler = exports.BotError = void 0;
const bot_1 = require("./bot");
/**
 * Custom error class for bot-specific errors
 */
class BotError extends Error {
    constructor(message, options) {
        super(message);
        this.name = 'BotError';
        this.chatId = options === null || options === void 0 ? void 0 : options.chatId;
        this.command = options === null || options === void 0 ? void 0 : options.command;
        this.severity = (options === null || options === void 0 ? void 0 : options.severity) || 'medium';
    }
}
exports.BotError = BotError;
/**
 * Handles errors that occur during bot operation
 */
class ErrorHandler {
    /**
     * Handle an error, notify user and admins as appropriate
     */
    static handleError(error, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = error.chatId || (msg === null || msg === void 0 ? void 0 : msg.chat.id);
            const command = error.command || (msg === null || msg === void 0 ? void 0 : msg.text);
            const severity = error.severity || 'medium';
            // Log the error
            console.error(`[ERROR] ${severity.toUpperCase()}: ${error.message}`, {
                chatId,
                command,
                stack: error.stack
            });
            // Notify the user if we have their chat ID
            if (chatId) {
                try {
                    let errorMessage;
                    if (severity === 'low') {
                        errorMessage = '⚠️ Something went wrong with your request. Please try again later.';
                    }
                    else if (severity === 'medium') {
                        errorMessage = '❌ We encountered an error processing your request. Our team has been notified.';
                    }
                    else {
                        errorMessage = '🚨 A critical error occurred. Our team has been notified and is working on a fix.';
                    }
                    yield bot_1.bot.sendMessage(chatId, errorMessage);
                }
                catch (notificationError) {
                    console.error('Failed to notify user about error:', notificationError);
                }
            }
            // Notify admins for medium and high severity errors
            if (severity !== 'low') {
                yield this.notifyAdmins(error, chatId, command, severity);
            }
        });
    }
    /**
     * Notify all admins about an error
     */
    static notifyAdmins(error, chatId, command, severity = 'medium') {
        return __awaiter(this, void 0, void 0, function* () {
            // Format the error details
            let message = `🔴 *Bot Error Notification*\n\n`;
            message += `Severity: ${this.getSeverityEmoji(severity)} ${severity.toUpperCase()}\n`;
            message += `Error: ${error.message}\n`;
            if (chatId) {
                message += `User: ${chatId}\n`;
            }
            if (command) {
                message += `Command: ${command}\n`;
            }
            if (this.DEBUG) {
                // Include stack trace in debug mode
                message += `\n*Stack Trace:*\n\`\`\`\n${error.stack || 'No stack trace'}\n\`\`\``;
            }
            // Send to all admins
            for (const adminId of this.adminIds) {
                try {
                    yield bot_1.bot.sendMessage(adminId, message, { parse_mode: 'Markdown' });
                }
                catch (notifyError) {
                    console.error(`Failed to notify admin ${adminId}:`, notifyError);
                }
            }
        });
    }
    /**
     * Get emoji for error severity
     */
    static getSeverityEmoji(severity) {
        switch (severity) {
            case 'low':
                return '⚠️';
            case 'medium':
                return '❌';
            case 'high':
                return '🚨';
        }
    }
    /**
     * Create a global error handler for the bot
     */
    static setupGlobalErrorHandler() {
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            this.notifyAdmins(error, undefined, undefined, 'high')
                .catch(notifyError => console.error('Error notifying admins:', notifyError));
        });
        process.on('unhandledRejection', (reason) => {
            const error = reason instanceof Error ? reason : new Error(String(reason));
            console.error('Unhandled Rejection:', error);
            this.notifyAdmins(error, undefined, undefined, 'high')
                .catch(notifyError => console.error('Error notifying admins:', notifyError));
        });
    }
}
exports.ErrorHandler = ErrorHandler;
ErrorHandler.DEBUG = process.env.DEBUG_MODE === 'true';
ErrorHandler.adminIds = ((_a = process.env.ADMIN_IDS) === null || _a === void 0 ? void 0 : _a.split(',').map(id => Number(id.trim()))) || [];
/**
 * Global wrapper to safely execute command handlers with error handling
 */
function safeExecute(callback, msg, commandName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield callback();
        }
        catch (error) {
            // Handle the error using our error handler
            const botError = error instanceof BotError ? error : new BotError(error instanceof Error ? error.message : String(error), {
                chatId: msg.chat.id,
                command: commandName || msg.text,
                severity: 'medium'
            });
            yield ErrorHandler.handleError(botError, msg);
        }
    });
}
exports.safeExecute = safeExecute;
//# sourceMappingURL=error-handler.js.map