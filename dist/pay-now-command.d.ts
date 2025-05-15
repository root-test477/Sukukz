import TelegramBot from 'node-telegram-bot-api';
/**
 * Handle the /pay_now command
 * Allows users to submit transaction IDs for admin approval
 */
export declare function handlePayNowCommand(msg: TelegramBot.Message): Promise<void>;
/**
 * Process transaction ID submission from user
 */
export declare function processTransactionSubmission(chatId: number, transactionId: string): Promise<void>;
/**
 * Handle the /approve command (admin-only)
 * Usage: /approve [submission_id] [optional notes]
 */
export declare function handleApproveCommand(msg: TelegramBot.Message): Promise<void>;
/**
 * Handle the /reject command (admin-only)
 * Usage: /reject [submission_id] [reason]
 */
export declare function handleRejectCommand(msg: TelegramBot.Message): Promise<void>;
/**
 * Handle pay_now cancel callback
 */
export declare function handlePayNowCancelCallback(query: TelegramBot.CallbackQuery): Promise<void>;
