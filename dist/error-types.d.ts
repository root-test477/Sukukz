/**
 * Custom error types for the bot
 */
export declare enum ErrorType {
    COMMAND_ERROR = "command_error",
    API_ERROR = "api_error",
    STORAGE_ERROR = "storage_error",
    WALLET_ERROR = "wallet_error",
    SYSTEM_ERROR = "system_error",
    UNKNOWN_ERROR = "unknown_error"
}
/**
 * Extended Error class with additional properties
 */
export declare class BotError extends Error {
    type: ErrorType;
    userId?: number;
    command?: string;
    timestamp: number;
    stack?: any;
    constructor(message: string, type?: ErrorType, userId?: number, command?: string);
    /**
     * Convert a standard error into a BotError
     */
    static fromError(error: Error, type?: ErrorType, userId?: number, command?: string): BotError;
    /**
     * Convert to a plain object for storage
     */
    toObject(): {
        type: ErrorType;
        message: string;
        command: string;
        userId: number;
        timestamp: number;
        stack: any;
    };
}
