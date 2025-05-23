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
    await client.connect();
}
// User data structure for tracking connected users
export interface UserData {
    chatId: number;
    botId: string;              // ID of the bot this user is interacting with
    displayName?: string;       // User's display name (first_name) for better identification
    username?: string;          // User's Telegram username (@username)
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
 * @param botId Bot's ID
 * @param displayName Optional display name of the user
 * @param username Optional username of the user (without @ symbol)
 */
export async function trackUserInteraction(chatId: number, botId: string, displayName?: string, username?: string): Promise<void> {
    const now = Date.now();
    
    // Create composite key for this user
    const userKey = `${chatId}:${botId}`;
    
    // Check if user already exists in any tracking system
    const existingUserData = await client.hGet('all_users', userKey);
    const connectedUserData = await client.hGet('connected_users', userKey);
    
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
            botId,
            displayName: displayName || undefined,
            username: username || undefined,
            firstSeenTimestamp: now,
            connectionTimestamp: 0, // Has never connected a wallet yet
            lastActivity: now,
            walletEverConnected: false
        };
        await client.hSet('all_users', userKey, JSON.stringify(userData));
        if (DEBUG) {
            console.log(`[STORAGE] Tracked new user: ${chatId}`);
        }
    }
    
    // If user already has a wallet connection, make sure they're marked as connected in all_users too
    if (connectedUserData && !existingUserData) {
        const connData: UserData = JSON.parse(connectedUserData);
        connData.walletEverConnected = true;
        await client.hSet('all_users', userKey, JSON.stringify(connData));
    }
}

/**
 * Save a user who has connected a wallet
 */
export async function saveConnectedUser(chatId: number, botId: string, walletAddress: string): Promise<void> {
    const now = Date.now();
    
    // Create composite key for this user
    const userKey = `${chatId}:${botId}`;
    
    // Get existing user data if any
    let userData: UserData;
    const existingUserData = await client.hGet('all_users', userKey);
    
    if (existingUserData) {
        userData = JSON.parse(existingUserData);
        userData.walletAddress = walletAddress;
        userData.connectionTimestamp = now;
        userData.lastActivity = now;
        userData.walletEverConnected = true;
    } else {
        userData = {
            chatId,
            botId,
            walletAddress,
            connectionTimestamp: now,
            lastActivity: now,
            firstSeenTimestamp: now, // First seen is now if not previously tracked
            walletEverConnected: true
        };
    }
    
    // Save to both connected users and all users
    await client.hSet('connected_users', userKey, JSON.stringify(userData));
    await client.hSet('all_users', userKey, JSON.stringify(userData));
    
    if (DEBUG) {
        console.log(`[STORAGE] Saved connected user: ${chatId} with wallet ${walletAddress}`);
    }
}

export async function updateUserActivity(chatId: number, botId: string, transactionAmount?: string): Promise<void> {
    const userKey = `${chatId}:${botId}`;
    const connectedData = await client.hGet('connected_users', userKey);
    if (connectedData) {
        const userData: UserData = JSON.parse(connectedData);
        userData.lastActivity = Date.now();
        if (transactionAmount) {
            userData.lastTransactionAmount = transactionAmount;
        }
        await client.hSet('connected_users', userKey, JSON.stringify(userData));
    }
    
    const allUsersData = await client.hGet('all_users', userKey);
    if (allUsersData) {
        const userData = JSON.parse(allUsersData);
        userData.lastActivity = Date.now();
        if (transactionAmount) userData.lastTransactionAmount = transactionAmount;
        await client.hSet('all_users', userKey, JSON.stringify(userData));
    }
    
    if (DEBUG) {
        console.log(`[STORAGE] Updated user activity: ${chatId}`);
    }
}

export async function removeConnectedUser(chatId: number, botId: string): Promise<void> {
    const userKey = `${chatId}:${botId}`;
    await client.hDel('connected_users', userKey);
    
    if (DEBUG) {
        console.log(`[STORAGE] Removed connected user: ${chatId}`);
    }
}

export async function getUserData(chatId: number, botId: string): Promise<UserData | null> {
    const userKey = `${chatId}:${botId}`;
    
    // First check connected users
    const connectedData = await client.hGet('connected_users', userKey);
    if (connectedData) return JSON.parse(connectedData);
    
    // Then check all users
    const allUsersData = await client.hGet('all_users', userKey);
    return allUsersData ? JSON.parse(allUsersData) : null;
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
    id: string;
    userId: number;
    botId: string;             // ID of the bot this transaction is associated with
    timestamp: number;
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: number;
    notes?: string;
}

export async function saveTransactionSubmission(chatId: number, botId: string, transactionId: string): Promise<void> {
    // Create a submission ID that includes the bot ID to prevent conflicts
    const submissionId = `${transactionId}:${botId}`;
    
    const submission: TransactionSubmission = {
        id: submissionId,
        userId: chatId,
        botId: botId,
        timestamp: Date.now(),
        status: 'pending'
    };
    
    await client.hSet('transaction_submissions', submissionId, JSON.stringify(submission));
    if (DEBUG) {
        console.log(`[STORAGE] Saved transaction submission: ${transactionId} from user ${chatId}`);
    }
}

export async function updateTransactionStatus(
    transactionId: string, 
    botId: string, 
    status: 'approved' | 'rejected', 
    adminId: number, 
    notes?: string
): Promise<TransactionSubmission | null> {
    const submissionId = `${transactionId}:${botId}`;
    const data = await client.hGet('transaction_submissions', submissionId);
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
    botId: string;       // ID of the bot this message is associated with
    adminId?: number;    // Admin's chat ID (if response)
    message: string;     // The message content
    timestamp: number;   // When the message was sent
    isResponse: boolean; // Whether this is a response from admin
}

export async function saveSupportMessage(message: SupportMessage): Promise<void> {
    await client.hSet('support_messages', message.id, JSON.stringify(message));
    // Also add to a user-specific list for quick lookup that includes the bot ID
    await client.sAdd(`support_messages:${message.userId}:${message.botId}`, message.id);
    
    if (DEBUG) {
        console.log(`[STORAGE] Saved support message: ${message.id} from ${message.isResponse ? 'admin' : 'user'} ${message.userId}`);
    }
}

export async function getSupportMessagesForUser(userId: number, botId: string): Promise<SupportMessage[]> {
    // Get all message IDs for this user and bot
    const messageIds = await client.sMembers(`support_messages:${userId}:${botId}`);
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
    constructor(private readonly chatId: number, private readonly botId: string) {}

    private getKey(key: string): string {
        // Create a composite key that includes both chatId and botId
        return `${this.chatId}:${this.botId}:${key}`;
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
