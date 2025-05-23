import TelegramBot from 'node-telegram-bot-api';
/**
 * Error boundary wrapper for bot command handlers
 * Prevents errors in individual commands from crashing the entire bot
 *
 * @param handler The original command handler function
 * @returns A wrapped function that catches errors
 */
export declare function withErrorBoundary<T extends any[]>(handler: (...args: T) => Promise<void>): (...args: T) => Promise<void>;
/**
 * Safe message sender that handles Markdown parsing errors
 * If sending with Markdown fails, it will retry without Markdown
 */
export declare function safeSendMessage(chatId: number, text: string, options?: TelegramBot.SendMessageOptions, botId?: string): Promise<TelegramBot.Message>;
