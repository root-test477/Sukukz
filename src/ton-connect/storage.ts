import { IStorage } from '@tonconnect/sdk';
import { createClient } from 'redis';
import * as process from 'process';

const DEBUG = process.env.DEBUG_MODE === 'true';
const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        connectTimeout: 10000,
        keepAlive: 10000
    }
});

client.on('error', err => console.log('Redis Client Error', err));

export async function initRedisClient(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    
    // Log Redis connection attempt
    console.log(`[REDIS] Attempting to connect to Redis at ${redisUrl}`);
    
    try {
        await client.connect();
        
        // Test the Redis connection
        const pingResult = await client.ping();
        console.log(`[REDIS] Connection successful. Ping response: ${pingResult}`);
        console.log(`[REDIS] Connected to Redis at ${redisUrl}`);
    } catch (error) {
        console.error('[REDIS] Connection failed:', error);
        throw error; // Rethrow to allow handling by the calling code
    }
}

// User data structure for tracking connected users
export interface UserData {
    chatId: number;
    displayName?: string;         // User's display name (first_name) for better identification
    username?: string;           // User's Telegram username (@username)
    walletAddress?: string;
    connectionTimestamp: number;
    lastActivity: number;
    lastTransactionAmount?: string;
    lastTransactionTimestamp?: number; // When the last transaction was made
    firstSeenTimestamp: number;   // When the user first interacted with the bot
    walletEverConnected: boolean; // Whether user has ever connected a wallet
    languagePreference?: string;  // User's preferred language
}

// Static methods for user tracking

/**
 * Track any user interaction with the bot, even if they haven't connected a wallet
 * @param chatId User's chat ID
 * @param displayName Optional display name of the user
 * @param username Optional username of the user (without @ symbol)
 */
export async function trackUserInteraction(chatId: number, displayName?: string, username?: string): Promise<void> {
    const now = Date.now();
    
    // Check if user already exists in any tracking system
    const existingUserData = await client.hGet('all_users', chatId.toString());
    const connectedUserData = await client.hGet('connected_users', chatId.toString());
    
    if (existingUserData) {
        // User already tracked, update lastActivity, displayName and username if provided
        const userData: UserData = JSON.parse(existingUserData);
        userData.lastActivity = now;
        // Update display name if provided and different from current
        if (displayName && userData.displayName !== displayName) {
            userData.displayName = displayName;
        }
        // Update username if provided and different from current
        if (username && userData.username !== username) {
            userData.username = username;
        }
        await client.hSet('all_users', chatId.toString(), JSON.stringify(userData));
    } else {
        // New user, create record
        const userData: UserData = {
            chatId,
            displayName: displayName || undefined,
            username: username || undefined,
            firstSeenTimestamp: now,
            connectionTimestamp: 0, // Has never connected a wallet yet
            lastActivity: now,
            walletEverConnected: false
        };
        await client.hSet('all_users', chatId.toString(), JSON.stringify(userData));
        if (DEBUG) {
            console.log(`[STORAGE] Tracked new user: ${chatId}`);
        }
    }
    
    // If user already has a wallet connection, make sure they're marked as connected in all_users too
    if (connectedUserData && !existingUserData) {
        const connData: UserData = JSON.parse(connectedUserData);
        connData.walletEverConnected = true;
        await client.hSet('all_users', chatId.toString(), JSON.stringify(connData));
    }
}

/**
 * Save a user who has connected a wallet
 */
export async function saveConnectedUser(chatId: number, walletAddress: string): Promise<void> {
    const now = Date.now();
    
    // Get existing user data if any
    let userData: UserData;
    const existingUserData = await client.hGet('all_users', chatId.toString());
    
    if (existingUserData) {
        userData = JSON.parse(existingUserData);
        userData.walletAddress = walletAddress;
        userData.connectionTimestamp = now;
        userData.lastActivity = now;
        userData.walletEverConnected = true;
    } else {
        userData = {
            chatId,
            walletAddress,
            connectionTimestamp: now,
            lastActivity: now,
            firstSeenTimestamp: now, // First seen is now if not previously tracked
            walletEverConnected: true
        };
    }
    
    // Update both connected_users and all_users
    await client.hSet('connected_users', chatId.toString(), JSON.stringify(userData));
    await client.hSet('all_users', chatId.toString(), JSON.stringify(userData));
    
    if (DEBUG) {
        console.log(`[STORAGE] Saved connected user: ${chatId} with wallet ${walletAddress}`);
    }
}

export async function updateUserActivity(chatId: number, transactionAmount?: string): Promise<void> {
    const userData = await getUserData(chatId);
    if (userData) {
        userData.lastActivity = Date.now();
        if (transactionAmount) {
            userData.lastTransactionAmount = transactionAmount;
        }
        await client.hSet('connected_users', chatId.toString(), JSON.stringify(userData));
        if (DEBUG) {
            console.log(`[STORAGE] Updated user activity: ${chatId}`);
        }
    }
}

export async function removeConnectedUser(chatId: number): Promise<void> {
    await client.hDel('connected_users', chatId.toString());
    if (DEBUG) {
        console.log(`[STORAGE] Removed connected user: ${chatId}`);
    }
}

export async function getUserData(chatId: number): Promise<UserData | null> {
    const data = await client.hGet('connected_users', chatId.toString());
    if (data) {
        return JSON.parse(data);
    }
    return null;
}

export async function getAllConnectedUsers(): Promise<UserData[]> {
    const users = await client.hGetAll('connected_users');
    return Object.values(users).map(userData => JSON.parse(userData));
}

/**
 * Get all users who have ever interacted with the bot
 */
export async function getAllTrackedUsers(): Promise<UserData[]> {
    const users = await client.hGetAll('all_users');
    return Object.values(users).map(userData => JSON.parse(userData));
}

/**
 * Set a user's language preference
 */
export async function setUserLanguage(chatId: number, languageCode: string): Promise<void> {
    // First check if user exists in tracking
    const existingUserData = await client.hGet('all_users', chatId.toString());
    
    if (existingUserData) {
        const userData: UserData = JSON.parse(existingUserData);
        userData.languagePreference = languageCode;
        await client.hSet('all_users', chatId.toString(), JSON.stringify(userData));
    } else {
        // Create new user entry with language preference
        const now = Date.now();
        const userData: UserData = {
            chatId,
            languagePreference: languageCode,
            firstSeenTimestamp: now,
            connectionTimestamp: 0,
            lastActivity: now,
            walletEverConnected: false
        };
        await client.hSet('all_users', chatId.toString(), JSON.stringify(userData));
    }
    
    // Also store in dedicated language preferences hash for quicker lookups
    await client.hSet('language_preferences', chatId.toString(), languageCode);
    
    if (DEBUG) {
        console.log(`[STORAGE] Set language preference for user ${chatId} to ${languageCode}`);
    }
}

/**
 * Get a user's language preference
 */
export async function getUserLanguage(chatId: number): Promise<string> {
    // Try getting from dedicated language hash first (faster)
    const language = await client.hGet('language_preferences', chatId.toString());
    if (language) {
        return language;
    }
    
    // If not found, check user data
    const existingUserData = await client.hGet('all_users', chatId.toString());
    if (existingUserData) {
        const userData: UserData = JSON.parse(existingUserData);
        return userData.languagePreference || 'en'; // Default to English
    }
    
    return 'en'; // Default language is English
}

// Transaction submission storage
export interface TransactionSubmission {
    id: string;          // Transaction ID or hash
    userId: number;     // User's chat ID
    timestamp: number;  // When the transaction was submitted
    status: 'pending' | 'approved' | 'rejected'; // Status of the transaction
    approvedBy?: number; // Admin who approved/rejected the transaction
    notes?: string;     // Optional notes from admin
}

export async function saveTransactionSubmission(chatId: number, transactionId: string): Promise<void> {
    const submission: TransactionSubmission = {
        id: transactionId,
        userId: chatId,
        timestamp: Date.now(),
        status: 'pending'
    };
    
    await client.hSet('transaction_submissions', transactionId, JSON.stringify(submission));
    if (DEBUG) {
        console.log(`[STORAGE] Saved transaction submission: ${transactionId} from user ${chatId}`);
    }
}

export async function updateTransactionStatus(
    transactionId: string, 
    status: 'approved' | 'rejected', 
    adminId: number, 
    notes?: string
): Promise<TransactionSubmission | null> {
    const data = await client.hGet('transaction_submissions', transactionId);
    if (!data) return null;
    
    const submission: TransactionSubmission = JSON.parse(data);
    submission.status = status;
    submission.approvedBy = adminId;
    if (notes) submission.notes = notes;
    
    await client.hSet('transaction_submissions', transactionId, JSON.stringify(submission));
    if (DEBUG) {
        console.log(`[STORAGE] Updated transaction ${transactionId} status to ${status} by admin ${adminId}`);
    }
    
    return submission;
}

export async function getTransactionSubmission(transactionId: string): Promise<TransactionSubmission | null> {
    const data = await client.hGet('transaction_submissions', transactionId);
    return data ? JSON.parse(data) : null;
}

export async function getAllPendingTransactions(): Promise<TransactionSubmission[]> {
    const transactions = await client.hGetAll('transaction_submissions');
    return Object.values(transactions)
        .map(data => JSON.parse(data))
        .filter((submission: TransactionSubmission) => submission.status === 'pending');
}

// Test result interface
export interface TestResult {
    testName: string;
    success: boolean;
    error?: string;
    timestamp: number;
}

/**
 * Save a test result
 */
export async function saveTestResult(chatId: number, result: TestResult): Promise<void> {
    // Generate a key for this test result
    const key = `test_result:${chatId}:${result.timestamp}`;
    await client.set(key, JSON.stringify(result));
    
    // Add to the list of test results for this admin
    await client.lPush(`test_results:${chatId}`, key);
    
    if (DEBUG) {
        console.log(`[STORAGE] Saved test result for ${result.testName} (${result.success ? 'Success' : 'Failure'})`);
    }
}

/**
 * Get all test results for an admin
 */
export async function getTestResults(chatId: number): Promise<TestResult[]> {
    // Get list of test result keys
    const resultKeys = await client.lRange(`test_results:${chatId}`, 0, -1);
    
    if (!resultKeys || resultKeys.length === 0) {
        return [];
    }
    
    // Fetch each result
    const results: TestResult[] = [];
    for (const key of resultKeys) {
        const data = await client.get(key);
        if (data) {
            results.push(JSON.parse(data));
        }
    }
    
    // Sort by timestamp, newest first
    return results.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Clear all test results for an admin
 */
export async function clearTestResults(chatId: number): Promise<void> {
    // Get list of test result keys
    const resultKeys = await client.lRange(`test_results:${chatId}`, 0, -1);
    
    if (resultKeys && resultKeys.length > 0) {
        // Delete each result
        for (const key of resultKeys) {
            await client.del(key);
        }
    }
    
    // Clear the list itself
    await client.del(`test_results:${chatId}`);
    
    if (DEBUG) {
        console.log(`[STORAGE] Cleared all test results for admin ${chatId}`);
    }
}
// Support message system
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
export async function saveSupportMessage(message: SupportMessage): Promise<void> {
    // Generate a unique key using userId and timestamp
    const key = `support:${message.userId}:${message.timestamp}`;
    await client.set(key, JSON.stringify(message));
    await client.hSet('support_messages', message.id, JSON.stringify(message));
    // Also add to a user-specific list for quick lookup
    await client.sAdd(`support_messages:${message.userId}`, message.id);
    
    if (DEBUG) {
        console.log(`[STORAGE] Saved support message: ${message.id} from ${message.isAdminResponse ? 'admin' : 'user'} ${message.userId}`);
    }
}

export async function getSupportMessagesForUser(userId: number): Promise<SupportMessage[]> {
    // Get all message IDs for this user
    const messageIds = await client.sMembers(`support_messages:${userId}`);
    if (!messageIds.length) return [];
    
    // Get all messages
    const messages: SupportMessage[] = [];
    for (const id of messageIds) {
        const data = await client.hGet('support_messages', id);
        if (data) {
            messages.push(JSON.parse(data));
        }
    }
    
    // Sort by timestamp
    return messages.sort((a, b) => a.timestamp - b.timestamp);
}

export class TonConnectStorage implements IStorage {
    constructor(private readonly chatId: number) {}

    private getKey(key: string): string {
        return this.chatId.toString() + key;
    }

    async removeItem(key: string): Promise<void> {
        const storeKey = this.getKey(key);
        await client.del(storeKey);
        if (DEBUG) {
            console.log(`[STORAGE] removeItem: ${storeKey}`);
        }
    }

    async setItem(key: string, value: string): Promise<void> {
        const storeKey = this.getKey(key);
        await client.set(storeKey, value);
        if (DEBUG) {
            console.log(`[STORAGE] setItem: ${storeKey} = ${value}`);
        }
    }

    async getItem(key: string): Promise<string | null> {
        const storeKey = this.getKey(key);
        const value = await client.get(storeKey);
        if (DEBUG) {
            console.log(`[STORAGE] getItem: ${storeKey} = ${value}`);
        }
        return value || null;
    }
}
