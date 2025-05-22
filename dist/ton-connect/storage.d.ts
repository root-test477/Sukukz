import { IStorage } from '@tonconnect/sdk';
export declare function initRedisClient(): Promise<void>;
export interface UserData {
    chatId: number;
    displayName?: string;
    username?: string;
    walletAddress?: string;
    connectionTimestamp: number;
    lastActivity: number;
    lastTransactionAmount?: string;
    firstSeenTimestamp: number;
    walletEverConnected: boolean;
    botId?: string;
}
/**
 * Track any user interaction with the bot, even if they haven't connected a wallet
 * @param chatId User's chat ID
 * @param displayName Optional display name of the user
 * @param username Optional username of the user (without @ symbol)
 * @param botId Optional ID of the bot the user is interacting with
 */
export declare function trackUserInteraction(chatId: number, displayName?: string, username?: string, botId?: string): Promise<void>;
/**
 * Save a user who has connected a wallet
 * @param chatId User's chat ID
 * @param walletAddress The wallet address to save
 * @param botId Optional ID of the bot the user is interacting with
 */
export declare function saveConnectedUser(chatId: number, walletAddress: string, botId?: string): Promise<void>;
export declare function updateUserActivity(chatId: number, transactionAmount?: string, botId?: string): Promise<void>;
export declare function removeConnectedUser(chatId: number, botId?: string): Promise<void>;
export declare function getUserData(chatId: number, botId?: string): Promise<UserData | null>;
export declare function getAllConnectedUsers(botId?: string): Promise<UserData[]>;
/**
 * Get all users who have ever interacted with the bot
 */
export declare function getAllTrackedUsers(botId?: string): Promise<UserData[]>;
export interface TransactionSubmission {
    id: string;
    userId: number;
    timestamp: number;
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: number;
    notes?: string;
}
export declare function saveTransactionSubmission(chatId: number, transactionId: string): Promise<void>;
export declare function updateTransactionStatus(transactionId: string, status: 'approved' | 'rejected', adminId: number, notes?: string): Promise<TransactionSubmission | null>;
export declare function getTransactionSubmission(transactionId: string): Promise<TransactionSubmission | null>;
export declare function getAllPendingTransactions(): Promise<TransactionSubmission[]>;
export interface SupportMessage {
    id: string;
    userId: number;
    adminId?: number;
    message: string;
    timestamp: number;
    isResponse: boolean;
}
export declare function saveSupportMessage(message: SupportMessage): Promise<void>;
export declare function getSupportMessagesForUser(userId: number): Promise<SupportMessage[]>;
export declare class TonConnectStorage implements IStorage {
    private readonly chatId;
    private readonly botId;
    constructor(chatId: number, botId?: string);
    private getKey;
    removeItem(key: string): Promise<void>;
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
}
