import { bot } from './bot';
import TelegramBot from 'node-telegram-bot-api';
import { isAdmin } from './utils';

/**
 * Types of errors that can occur in the bot
 */
export enum ErrorType {
    COMMAND_HANDLER = 'command_handler',
    CALLBACK_HANDLER = 'callback_handler',
    WALLET_CONNECTION = 'wallet_connection',
    REDIS_STORAGE = 'redis_storage',
    TRANSACTION = 'transaction',
    GENERAL = 'general',
    UNKNOWN = 'unknown' // Added for undefined error types
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
export class ErrorHandler {
    private static errors: ErrorDetails[] = [];
    private static readonly MAX_ERRORS = 100; // Maximum number of errors to keep in memory

    /**
     * Wraps a command handler in a try-catch block
     * @param handler The command handler function
     * @returns A wrapped handler that won't crash the bot
     */
    public static wrapCommandHandler<T extends any[]>(
        handler: (...args: T) => Promise<void>,
        command: string
    ): (...args: T) => Promise<void> {
        return async (...args: T) => {
            try {
                await handler(...args);
            } catch (error: any) {
                // Get the message and chat ID from the first argument if available
                let chatId: number | undefined;
                let userId: number | undefined;
                
                if (args.length > 0 && args[0] && 'chat' in args[0]) {
                    const msg = args[0] as TelegramBot.Message;
                    chatId = msg.chat.id;
                    userId = msg.from?.id;
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
                    await bot.sendMessage(
                        chatId,
                        `⚠️ Sorry, an error occurred while processing the /${command} command. Please try again later.`
                    );
                }
            }
        };
    }

    /**
     * Wraps a callback query handler in a try-catch block
     * @param handler The callback query handler function
     * @param method The callback method name
     * @returns A wrapped handler that won't crash the bot
     */
    public static wrapCallbackHandler<T extends any[]>(
        handler: (...args: T) => Promise<void>,
        method: string
    ): (...args: T) => Promise<void> {
        return async (...args: T) => {
            try {
                await handler(...args);
            } catch (error: any) {
                // Get the chat ID from the first argument if available
                let chatId: number | undefined;
                let userId: number | undefined;
                
                if (args.length > 0 && args[0] && 'from' in args[0]) {
                    const query = args[0] as TelegramBot.CallbackQuery;
                    chatId = query.message?.chat.id;
                    userId = query.from?.id;
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
                    const query = args[0] as TelegramBot.CallbackQuery;
                    try {
                        await bot.answerCallbackQuery(query.id, {
                            text: "An error occurred. Please try again."
                        });
                    } catch (e: any) {
                        // Ignore errors when answering the callback query
                    }
                }

                // Send error message to user if chat ID is available
                if (chatId) {
                    await bot.sendMessage(
                        chatId,
                        `⚠️ Sorry, an error occurred while processing your request. Please try again later.`
                    );
                }
            }
        };
    }

    /**
     * Handle a general error
     * @param errorDetails Error details to log
     */
    public static handleError(errorDetails: ErrorDetails): void {
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
    public static getRecentErrors(limit: number = 10): ErrorDetails[] {
        return this.errors.slice(0, limit);
    }

    /**
     * Send error report to admin(s)
     * @param chatId Admin chat ID to send the report to
     * @param limit Number of recent errors to include
     */
    public static async sendErrorReport(chatId: number, limit: number = 10): Promise<void> {
        if (!isAdmin(chatId)) {
            await bot.sendMessage(chatId, "⚠️ Sorry, this command is only available to administrators.");
            return;
        }

        const recentErrors = ErrorHandler.getRecentErrors(limit);
        
        if (recentErrors.length === 0) {
            await bot.sendMessage(chatId, "✅ No errors have been recorded!");
            return;
        }
        
        let message = `📊 Recent Error Report (Last ${recentErrors.length}):\n\n`;
        
        for (let i = 0; i < recentErrors.length; i++) {
            const error = recentErrors[i];
            if (!error) continue; // Skip if error is undefined
            
            const date = new Date(error.timestamp).toLocaleString();
            const errorType = error.type || ErrorType.UNKNOWN;
            const userId = error.userId || 'Unknown';
            const errorMessage = error.message || 'No message';
            const commandStr = error.command ? ` (/${error.command})` : '';
            
            message += `${i+1}. ${errorType}${commandStr}\n`
                    + `   Time: ${date}\n`
                    + `   User: ${userId}\n`
                    + `   Message: ${errorMessage}\n\n`;
        }
        
        await bot.sendMessage(chatId, message);
    }

    /**
     * Register the /errors command for admins
     * This should be called during initialization
     */
    public static registerErrorReportCommand(): void {
        bot.onText(/\/errors(?:\s+(\d+))?/, async (msg: TelegramBot.Message, match: RegExpExecArray | null) => {
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
                
                await ErrorHandler.sendErrorReport(chatId, limit);
            } catch (error: any) {
                console.error('Error in error report command:', error?.message || error);
            }
        });
    }
}
