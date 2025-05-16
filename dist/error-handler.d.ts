/**
 * Types of errors that can occur in the bot
 */
export declare enum ErrorType {
    COMMAND_HANDLER = "command_handler",
    CALLBACK_HANDLER = "callback_handler",
    WALLET_CONNECTION = "wallet_connection",
    REDIS_STORAGE = "redis_storage",
    TRANSACTION = "transaction",
    GENERAL = "general",
    UNKNOWN = "unknown"
}
/**
 * Error details to be logged/reported
 */
export interface ErrorDetails {
    type: ErrorType;
    message: string;
    command?: string;
    userId?: number;
    timestamp: number;
    stack?: string;
    metadata?: Record<string, any>;
}
/**
 * Class to handle all errors in the bot and prevent crashes
 */
export declare class ErrorHandler {
    private static errors;
    private static readonly MAX_ERRORS;
    /**
     * Wraps a command handler in a try-catch block
     * @param handler The command handler function
     * @returns A wrapped handler that won't crash the bot
     */
    static wrapCommandHandler<T extends any[]>(handler: (...args: T) => Promise<void>, command: string): (...args: T) => Promise<void>;
    /**
     * Wraps a callback query handler in a try-catch block
     * @param handler The callback query handler function
     * @param method The callback method name
     * @returns A wrapped handler that won't crash the bot
     */
    static wrapCallbackHandler<T extends any[]>(handler: (...args: T) => Promise<void>, method: string): (...args: T) => Promise<void>;
    /**
     * Handle a general error
     * @param errorDetails Error details to log
     */
    static handleError(errorDetails: ErrorDetails): void;
    /**
     * Get the most recent errors
     * @param limit Maximum number of errors to return
     * @returns List of recent errors
     */
    static getRecentErrors(limit?: number): ErrorDetails[];
    /**
     * Send error report to admin(s)
     * @param chatId Admin chat ID to send the report to
     * @param limit Number of recent errors to include
     */
    static sendErrorReport(chatId: number, limit?: number): Promise<void>;
    /**
     * Register the /errors command for admins
     * This should be called during initialization
     */
    static registerErrorReportCommand(): void;
}
