import TelegramBot from 'node-telegram-bot-api';
/**
 * Schedule a message to be sent later
 *
 * @param delay Milliseconds to delay the message
 * @param targetUsers Target audience for the message
 * @param message Message text to send
 * @param specificUserId Optional specific user ID for targeted messages
 * @param createdBy Admin user ID who scheduled the message
 * @returns Task ID and execution time
 */
export declare function scheduleMessage(delay: number, targetUsers: 'specific' | 'all' | 'active' | 'inactive', message: string, specificUserId: number | undefined, createdBy: number, botId: string): {
    taskId: string;
    executionTime: Date;
};
/**
 * Handle the /schedule command for scheduling messages
 * This is an admin-only command
 *
 * @param msg Telegram message object
 */
export declare function handleScheduleCommand(msg: TelegramBot.Message, botId: string): Promise<void>;
