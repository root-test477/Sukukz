import TelegramBot from 'node-telegram-bot-api';
/**
 * Custom error class for bot-specific errors
 */
export declare class BotError extends Error {
    readonly chatId?: number;
    readonly command?: string;
    readonly severity: 'low' | 'medium' | 'high';
    constructor(message: string, options?: {
        chatId?: number;
        command?: string;
        severity?: 'low' | 'medium' | 'high';
    });
}
/**
 * Handles errors that occur during bot operation
 */
export declare class ErrorHandler {
    private static readonly DEBUG;
    private static readonly adminIds;
    /**
     * Handle an error, notify user and admins as appropriate
     */
    static handleError(error: Error | BotError, msg?: TelegramBot.Message): Promise<void>;
    /**
     * Notify all admins about an error
     */
    private static notifyAdmins;
    /**
     * Get emoji for error severity
     */
    private static getSeverityEmoji;
    /**
     * Create a global error handler for the bot
     */
    static setupGlobalErrorHandler(): void;
}
/**
 * Global wrapper to safely execute command handlers with error handling
 */
export declare function safeExecute(callback: () => Promise<void>, msg: TelegramBot.Message, commandName?: string): Promise<void>;
