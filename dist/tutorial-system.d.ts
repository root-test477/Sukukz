import TelegramBot from 'node-telegram-bot-api';
/**
 * Start tutorial for a user
 */
export declare function startTutorial(chatId: number): Promise<void>;
/**
 * Handle tutorial navigation callback queries
 */
export declare function handleTutorialCallback(query: TelegramBot.CallbackQuery, method: string): Promise<void>;
/**
 * Handler for the /tutorial command
 */
export declare const handleTutorialCommand: (msg: TelegramBot.Message, ...args: any[]) => Promise<void>;
/**
 * Handler for the /skip command
 */
export declare const handleSkipCommand: (msg: TelegramBot.Message, ...args: any[]) => Promise<void>;
