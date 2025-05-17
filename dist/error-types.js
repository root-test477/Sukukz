"use strict";
/**
 * Custom error types for the bot
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotError = exports.ErrorType = void 0;
var ErrorType;
(function (ErrorType) {
    ErrorType["COMMAND_ERROR"] = "command_error";
    ErrorType["API_ERROR"] = "api_error";
    ErrorType["STORAGE_ERROR"] = "storage_error";
    ErrorType["WALLET_ERROR"] = "wallet_error";
    ErrorType["SYSTEM_ERROR"] = "system_error";
    ErrorType["UNKNOWN_ERROR"] = "unknown_error";
})(ErrorType = exports.ErrorType || (exports.ErrorType = {}));
/**
 * Extended Error class with additional properties
 */
class BotError extends Error {
    constructor(message, type = ErrorType.UNKNOWN_ERROR, userId, command) {
        super(message);
        this.name = 'BotError';
        this.type = type;
        this.userId = userId;
        this.command = command;
        this.timestamp = Date.now();
    }
    /**
     * Convert a standard error into a BotError
     */
    static fromError(error, type = ErrorType.UNKNOWN_ERROR, userId, command) {
        const botError = new BotError(error.message, type, userId, command);
        botError.stack = error.stack;
        return botError;
    }
    /**
     * Convert to a plain object for storage
     */
    toObject() {
        return {
            type: this.type,
            message: this.message,
            command: this.command,
            userId: this.userId,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
}
exports.BotError = BotError;
//# sourceMappingURL=error-types.js.map