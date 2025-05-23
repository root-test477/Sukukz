import TelegramBot from 'node-telegram-bot-api';
export declare function handleConnectCommand(msg: TelegramBot.Message, botId: string): Promise<void>;
export declare function handleSendTXCommand(msg: TelegramBot.Message, botId: string): Promise<void>;
export declare function handleDisconnectCommand(msg: TelegramBot.Message, botId: string): Promise<void>;
/**
 * Attempt to safely restore a wallet connection with retries
 * @param connector - The connector to restore
 * @param chatId - The chat ID for logging
 * @param botId - The bot ID for logging
 * @returns true if connection was successful, false otherwise
 */
export declare function safeRestoreConnection(connector: any, chatId: number, _botId: string): Promise<boolean>;
export declare function handleShowMyWalletCommand(msg: TelegramBot.Message, botId: string): Promise<void>;
/**
 * Handler for the /approve_transaction command (admin-only)
 * Approves a pending transaction that a user has submitted via /transaction command
 */
export declare function handleApproveTransactionCommand(msg: TelegramBot.Message, botId: string): Promise<void>;
/**
 * Handler for the /user command (admin-only)
 * Shows detailed information about a user by ID or username
 */
export declare function handleUserCommand(msg: TelegramBot.Message, botId: string): Promise<void>;
/**
 * Handler for the /users command (admin-only)
 * Shows all users who have interacted with the bot, including those who never connected a wallet
 */
export declare function handleUsersCommand(msg: TelegramBot.Message, botId: string): Promise<void>;
