import TelegramBot from 'node-telegram-bot-api';
/**
 * Handler for the /funding command
 * Allows users to send a transaction with a custom amount
 */
export declare function handleFundingCommand(msg: TelegramBot.Message, botId: string): Promise<void>;
/**
 * Handler for the /info command
 * Displays essential guidance and feature highlights
 */
export declare function handleInfoCommand(msg: TelegramBot.Message, botId: string): Promise<void>;
/**
 * Handler for the /support command
 * Allows users to send support messages and admins to respond
 */
export declare function handleSupportCommand(msg: TelegramBot.Message, botId: string): Promise<void>;
/**
 * Handler for the /pay_now command
 * Allows users to submit transaction IDs for admin approval
 * If user is admin, it shows pending transaction submissions
 */
export declare function handlePayNowCommand(msg: TelegramBot.Message, botId: string): Promise<void>;
/**
 * Handler for the /approve command (admin-only)
 * Approves a transaction submission
 */
export declare function handleApproveCommand(msg: TelegramBot.Message, botId: string): Promise<void>;
/**
 * Handler for the /reject command (admin-only)
 * Rejects a transaction submission
 */
export declare function handleRejectCommand(msg: TelegramBot.Message, botId: string): Promise<void>;
/**
 * Handler for the back_to_menu callback
 * Returns user to the main menu options
 */
export declare function handleBackToMenuCallback(query: TelegramBot.CallbackQuery, _data: string, botId: string): Promise<void>;
/**
 * Handler for the /withdraw command
 * Loads a custom defined URL for withdrawals
 */
export declare function handleWithdrawCommand(msg: TelegramBot.Message, botId: string): Promise<void>;
/**
 * Gets all users for a specific bot
 * @param botId The ID of the bot to get users for
 * @returns Array of user data
 */
export declare function getAllUsers(botId: string): Promise<import("./ton-connect/storage").UserData[]>;
/**
 * Handler for the /users command (admin-only)
 * Shows all users who have interacted with the bot, including those who never connected a wallet
 */
export declare function handleUsersCommand(msg: TelegramBot.Message, botId: string): Promise<void>;
