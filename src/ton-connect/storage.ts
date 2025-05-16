import { IStorage } from '@tonconnect/sdk';
import { createClient, RedisClientType } from 'redis';
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
    await client.connect();
}

/**
 * Get the Redis client instance
 * For use in other modules that need direct access
 */
export async function getRedisClient(): Promise<RedisClientType> {
    if (!client.isOpen) {
        await client.connect();
    }
    return client as RedisClientType;
}

// In-memory wallet cache for better performance
const walletCache: Map<number, {data: any, timestamp: number}> = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute TTL

/**
 * Cache-enabled wallet data retrieval
 */
export async function getCachedWalletData(chatId: number): Promise<any | null> {
    // First check the in-memory cache
    const cached = walletCache.get(chatId);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        if (DEBUG) console.log(`[CACHE] Hit for wallet data: ${chatId}`);
        return cached.data;
    }
    
    // If not in cache or expired, get from Redis
    const key = `${chatId}wallet_info`;
    const data = await client.get(key);
    
    if (data) {
        // Update cache
        const parsed = JSON.parse(data);
        walletCache.set(chatId, {
            data: parsed,
            timestamp: Date.now()
        });
        if (DEBUG) console.log(`[CACHE] Updated for wallet data: ${chatId}`);
        return parsed;
    }
    
    return null;
}

/**
 * Update cache when wallet data changes
 */
export function invalidateWalletCache(chatId: number): void {
    walletCache.delete(chatId);
    if (DEBUG) console.log(`[CACHE] Invalidated for wallet data: ${chatId}`);
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
    firstSeenTimestamp: number;   // When the user first interacted with the bot
    walletEverConnected: boolean; // Whether user has ever connected a wallet
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
    // Invalidate cache for this user
    invalidateWalletCache(chatId);
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
    // Invalidate cache for this user
    invalidateWalletCache(chatId);
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

// Support message system
export interface SupportMessage {
    id: string;           // Message ID (timestamp + random string)
    userId: number;      // User's chat ID
    adminId?: number;    // Admin's chat ID (if response)
    message: string;     // The message content
    timestamp: number;   // When the message was sent
    isResponse: boolean; // Whether this is a response from admin
}

export async function saveSupportMessage(message: SupportMessage): Promise<void> {
    await client.hSet('support_messages', message.id, JSON.stringify(message));
    // Also add to a user-specific list for quick lookup
    await client.sAdd(`support_messages:${message.userId}`, message.id);
    
    if (DEBUG) {
        console.log(`[STORAGE] Saved support message: ${message.id} from ${message.isResponse ? 'admin' : 'user'} ${message.userId}`);
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

/**
 * Error Reporting System
 */

// Save an error report to Redis
export async function saveErrorReport(report: any): Promise<void> {
    const id = report.id;
    const timestamp = report.timestamp;
    
    // Store individual error report
    await client.hSet(`error:${id}`, {
        timestamp: timestamp,
        commandName: report.commandName,
        userId: report.userId.toString(),
        userMessage: report.userMessage,
        error: report.error,
        stack: report.stack || ''
    });
    
    // Add to sorted set by timestamp for easy retrieval
    await client.zAdd('error_reports', [{
        score: new Date(timestamp).getTime(),
        value: id
    }]);
    
    // Maintain only the last 100 error reports
    const count = await client.zCard('error_reports');
    if (count > 100) {
        const toRemove = count - 100;
        const oldestIds = await client.zRange('error_reports', 0, toRemove - 1);
        
        if (oldestIds.length > 0) {
            // Remove from sorted set
            await client.zRem('error_reports', oldestIds);
            
            // Remove individual error reports
            for (const oldId of oldestIds) {
                await client.del(`error:${oldId}`);
            }
        }
    }
    
    if (DEBUG) {
        console.log(`[STORAGE] Saved error report: ${id}`);
    }
}

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

// Save a user's tutorial state
export async function saveTutorialState(state: TutorialState): Promise<void> {
    await client.hSet('tutorial_states', state.userId.toString(), JSON.stringify(state));
    if (DEBUG) {
        console.log(`[STORAGE] Saved tutorial state for user: ${state.userId}, step: ${state.currentStep}`);
    }
}

// Get a user's tutorial state
export async function getTutorialState(userId: number): Promise<TutorialState | null> {
    const data = await client.hGet('tutorial_states', userId.toString());
    return data ? JSON.parse(data) : null;
}

/**
 * Analytics Storage
 */

// Track a specific analytics event
export async function trackAnalyticsEvent(eventType: string, userId: number, metadata?: any): Promise<void> {
    const timestamp = Date.now();
    const eventId = `${timestamp}:${Math.random().toString(36).substring(2, 8)}`;
    
    const event = {
        id: eventId,
        type: eventType,
        userId: userId,
        timestamp: timestamp,
        metadata: metadata || {}
    };
    
    // Store event in Redis
    await client.hSet('analytics_events', eventId, JSON.stringify(event));
    
    // Add to sorted set by timestamp
    await client.zAdd('analytics_events_by_time', [{
        score: timestamp,
        value: eventId
    }]);
    
    // Add to set of events by type
    await client.sAdd(`analytics_events:${eventType}`, eventId);
    
    // Add to set of events by user
    await client.sAdd(`analytics_events:user:${userId}`, eventId);
    
    if (DEBUG) {
        console.log(`[ANALYTICS] Tracked ${eventType} for user ${userId}`);
    }
}

// Get analytics counts for dashboard
export async function getAnalyticsSummary(): Promise<any> {
    // Get total users
    const totalUsers = await client.hLen('all_users');
    
    // Get connected wallet users
    const connectedUsers = await client.hLen('connected_users');
    
    // Get active users in last 24 hours
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    const allUsersData = await client.hGetAll('all_users');
    const activeUsers = Object.values(allUsersData)
        .map(data => JSON.parse(data))
        .filter((userData: UserData) => userData.lastActivity > oneDayAgo)
        .length;
    
    // Get transaction counts
    const transactions = await client.hGetAll('transaction_submissions');
    const transactionCount = Object.keys(transactions).length;
    
    // Count by status
    const pendingTransactions = Object.values(transactions)
        .map(data => JSON.parse(data))
        .filter((tx: TransactionSubmission) => tx.status === 'pending')
        .length;
    
    const approvedTransactions = Object.values(transactions)
        .map(data => JSON.parse(data))
        .filter((tx: TransactionSubmission) => tx.status === 'approved')
        .length;
    
    const rejectedTransactions = Object.values(transactions)
        .map(data => JSON.parse(data))
        .filter((tx: TransactionSubmission) => tx.status === 'rejected')
        .length;
    
    // Return the summary
    return {
        totalUsers,
        connectedUsers,
        activeUsers24h: activeUsers,
        transactionStats: {
            total: transactionCount,
            pending: pendingTransactions,
            approved: approvedTransactions,
            rejected: rejectedTransactions
        },
        timestamp: now
    };
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
