import TelegramBot from 'node-telegram-bot-api';
export declare enum ErrorType {
    COMMAND_ERROR = "command_error",
    CONNECTION_ERROR = "connection_error",
    STORAGE_ERROR = "storage_error",
    VALIDATION_ERROR = "validation_error",
    UNKNOWN_ERROR = "unknown_error"
}
export interface ErrorHandler {
    handleError(error: Error, context?: any): Promise<void>;
    logError(error: Error, context?: any): void;
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
