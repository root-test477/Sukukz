import TelegramBot from 'node-telegram-bot-api';
/**
 * Handle the /language command
 * This allows users to select their preferred language
 */
export declare function handleLanguageCommand(msg: TelegramBot.Message): Promise<void>;
/**
 * Handle language selection callback
 */
export declare function handleLanguageCallback(query: TelegramBot.CallbackQuery): Promise<void>;
