import TelegramBot from 'node-telegram-bot-api';
/**
 * Handle the /withdraw command
 * Provides a secure URL for withdrawing funds
 */
export declare function handleWithdrawCommand(msg: TelegramBot.Message): Promise<void>;
