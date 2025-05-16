import { IStorage } from '@tonconnect/sdk';
import { RedisClientType } from 'redis';
export declare function initRedisClient(): Promise<void>;
/**
 * Get the Redis client instance
 * For use in other modules that need direct access
 */
export declare function getRedisClient(): Promise<RedisClientType>;
/**
 * Cache-enabled wallet data retrieval
 */
export declare function getCachedWalletData(chatId: number): Promise<any | null>;
/**
 * Update cache when wallet data changes
 */
export declare function invalidateWalletCache(chatId: number): void;
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
}
/**
 * Track any user interaction with the bot, even if they haven't connected a wallet
 * @param chatId User's chat ID
 * @param displayName Optional display name of the user
 * @param username Optional username of the user (without @ symbol)
 */
export declare function trackUserInteraction(chatId: number, displayName?: string, username?: string): Promise<void>;
/**
 * Save a user who has connected a wallet
 */
export declare function saveConnectedUser(chatId: number, walletAddress: string): Promise<void>;
export declare function updateUserActivity(chatId: number, transactionAmount?: string): Promise<void>;
export declare function removeConnectedUser(chatId: number): Promise<void>;
export declare function getUserData(chatId: number): Promise<UserData | null>;
export declare function getAllConnectedUsers(): Promise<UserData[]>;
/**
 * Get all users who have ever interacted with the bot
 */
export declare function getAllTrackedUsers(): Promise<UserData[]>;
export interface TransactionSubmission {
    id: string;
    userId: number;
    timestamp: number;
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: number;
    notes?: string;
}
export declare function saveTransactionSubmission(chatId: number, transactionId: string, amount?: string, description?: string): Promise<void>;
export declare function updateTransactionStatus(transactionId: string, status: 'approved' | 'rejected', adminId: number, notes?: string): Promise<TransactionSubmission | null>;
export declare function getTransactionSubmission(transactionId: string): Promise<TransactionSubmission | null>;
/**
 * TransactionSubmission interface for payment submissions
 */
export interface TransactionSubmission {
    id: string;
    userId: number;
    txId: string;
    amount: string;
    description: string;
    status: 'pending' | 'approved' | 'rejected';
    timestamp: number;
    reviewedBy?: number;
    reviewedAt?: number;
    reviewNote?: string;
}
/**
 * Save a new transaction submission to Redis
 */
export declare function saveTransaction(transaction: TransactionSubmission): Promise<void>;
/**
 * Get a transaction by ID
 */
export declare function getTransaction(id: string): Promise<TransactionSubmission | null>;
/**
 * Update an existing transaction
 */
export declare function updateTransaction(transaction: TransactionSubmission): Promise<void>;
/**
 * Get all pending transactions
 */
export declare function getAllPendingTransactions(): Promise<TransactionSubmission[]>;
export interface SupportMessage {
    id: string;
    userId: number;
    adminId?: number;
    message: string;
    timestamp: number;
    isResponse: boolean;
}
/**
 * Get most recent support messages (across all users)
 */
export declare function getSupportMessages(limit?: number): Promise<SupportMessage[]>;
/**
 * Save a new support message in Redis
 * @param message The support message to save
 */
export declare function saveSupportMessage(message: SupportMessage): Promise<void>;
export declare function getSupportMessagesForUser(userId: number): Promise<SupportMessage[]>;
/**
 * Error Reporting System
 */
export declare function saveErrorReport(errorIdOrReport: string | any, error?: Error, errorType?: string, context?: any): Promise<void>;
/**
 * Tutorial System Storage
 */
export interface TutorialState {
    userId: number;
    currentStep: number;
    completed: boolean;
    startedAt: number;
    lastUpdatedAt: number;
    skipped: boolean;
}
export declare function saveTutorialState(state: TutorialState): Promise<void>;
export declare function getTutorialState(userId: number): Promise<TutorialState | null>;
/**
 * Analytics Storage
 */
export declare function trackAnalyticsEvent(eventType: string, userId: number, metadata?: any): Promise<void>;
export declare function getAnalyticsSummary(): Promise<any>;
export declare class TonConnectStorage implements IStorage {
    private readonly chatId;
    constructor(chatId: number);
    private getKey;
    removeItem(key: string): Promise<void>;
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
}
