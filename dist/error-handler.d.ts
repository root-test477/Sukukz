import TelegramBot from 'node-telegram-bot-api';
export declare enum ErrorType {
    GENERAL = "general",
    COMMAND_HANDLER = "command_handler",
    WALLET_CONNECTION = "wallet_connection",
    REDIS_STORAGE = "redis_storage",
    TRANSACTION = "transaction",
    API_INTEGRATION = "api_integration",
    COMMAND_ERROR = "command_error",
    CONNECTION_ERROR = "connection_error",
    STORAGE_ERROR = "storage_error",
    VALIDATION_ERROR = "validation_error",
    UNKNOWN_ERROR = "unknown_error"
}
/**
 * Error handler class with static methods
 */
export declare class ErrorHandler {
    /**
     * Handle an error with the specified error type
     */
    static handleError(error: Error, errorType?: ErrorType, context?: any): Promise<string>;
    /**
     * Log an error to the console
     */
    static logError(error: Error, errorType?: ErrorType, context?: any): void;
}
/**
 * Global error handler for command execution
 * Wraps command handlers to prevent crashes and log errors
 */
export declare function withErrorHandling(handler: (msg: TelegramBot.Message, ...args: any[]) => Promise<void>, commandName: string): (msg: TelegramBot.Message, ...args: any[]) => Promise<void>;
/**
 * Handle uncaught exceptions and unhandled rejections at process level
 */
export declare function setupGlobalErrorHandlers(): void;
/**
 * Handler for the /errors command (admin-only)
 * Retrieves recent error reports
 */
export declare function handleErrorsCommand(msg: TelegramBot.Message): Promise<void>;
