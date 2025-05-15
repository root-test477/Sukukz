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
    lastTransactionTimestamp?: number;
    firstSeenTimestamp: number;
    walletEverConnected: boolean;
    languagePreference?: string;
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
/**
 * Set a user's language preference
 */
export declare function setUserLanguage(chatId: number, languageCode: string): Promise<void>;
/**
 * Get a user's language preference
 */
export declare function getUserLanguage(chatId: number): Promise<string>;
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
export interface TestResult {
    testName: string;
    success: boolean;
    error?: string;
    timestamp: number;
}
/**
 * Save a test result
 */
export declare function saveTestResult(chatId: number, result: TestResult): Promise<void>;
/**
 * Get all test results for an admin
 */
export declare function getTestResults(chatId: number): Promise<TestResult[]>;
/**
 * Clear all test results for an admin
 */
export declare function clearTestResults(chatId: number): Promise<void>;
export interface SupportMessage {
    id: string;
    userId: number;
    message: string;
    timestamp: number;
    isAdminResponse: boolean;
    adminId?: number;
}
/**
 * Save a support message from a user or admin response
 */
export declare function saveSupportMessage(message: SupportMessage): Promise<void>;
export declare function getSupportMessagesForUser(userId: number): Promise<SupportMessage[]>;
export declare class TonConnectStorage implements IStorage {
    private readonly chatId;
    constructor(chatId: number);
    private getKey;
    removeItem(key: string): Promise<void>;
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
}
