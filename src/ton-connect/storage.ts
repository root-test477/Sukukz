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
    botId: string;              // Added botId to identify which bot the user is interacting with
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
 * @param botId Bot ID the user is interacting with
 * @param displayName Optional display name of the user
 * @param username Optional username of the user (without @ symbol)
 */
export async function trackUserInteraction(chatId: number, botId: string, displayName?: string, username?: string): Promise<void> {
    const now = Date.now();
    const compositeKey = `${chatId}:${botId}`;
    
    // Check if user already exists in any tracking system
    const existingUserData = await client.hGet('all_users', compositeKey);
    const connectedUserData = await client.hGet('connected_users', compositeKey);
    
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
        await client.hSet('all_users', compositeKey, JSON.stringify(userData));
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
        await client.hSet('all_users', compositeKey, JSON.stringify(userData));
        if (DEBUG) {
            console.log(`[STORAGE] Tracked new user: ${chatId} for bot: ${botId}`);
        }
    }
    
    // If user already has a wallet connection, make sure they're marked as connected in all_users too
    if (connectedUserData && !existingUserData) {
        const connData: UserData = JSON.parse(connectedUserData);
        connData.walletEverConnected = true;
        await client.hSet('all_users', compositeKey, JSON.stringify(connData));
    }
}

/**
 * Save a user who has connected a wallet
 * @param chatId User's chat ID
 * @param botId Bot ID the user is interacting with
 * @param walletAddress User's wallet address
 */
export async function saveConnectedUser(chatId: number, botId: string, walletAddress: string): Promise<void> {
    const now = Date.now();
    const compositeKey = `${chatId}:${botId}`;
    
    // Get existing user data if any
    let userData: UserData;
    const existingUserData = await client.hGet('all_users', compositeKey);
    
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
            firstSeenTimestamp: now,
            connectionTimestamp: now,
            lastActivity: now,
            walletEverConnected: true
        };
    }
    
    // Update both collections
    await client.hSet('connected_users', compositeKey, JSON.stringify(userData));
    await client.hSet('all_users', compositeKey, JSON.stringify(userData));
    
    if (DEBUG) {
        console.log(`[STORAGE] Saved connected user: ${chatId} for bot: ${botId} with wallet: ${walletAddress}`);
    }
}

export async function updateUserActivity(chatId: number, botId: string, transactionAmount?: string): Promise<void> {
    const now = Date.now();
    const compositeKey = `${chatId}:${botId}`;
    
    // Update in connected_users if exists
    const connectedData = await client.hGet('connected_users', compositeKey);
    if (connectedData) {
        const userData: UserData = JSON.parse(connectedData);
        userData.lastActivity = now;
        if (transactionAmount) {
            userData.lastTransactionAmount = transactionAmount;
        }
        await client.hSet('connected_users', compositeKey, JSON.stringify(userData));
    }
    
    // Always update in all_users
    const allUserData = await client.hGet('all_users', compositeKey);
    if (allUserData) {
        const userData: UserData = JSON.parse(allUserData);
        userData.lastActivity = now;
        if (transactionAmount) {
            userData.lastTransactionAmount = transactionAmount;
        }
        await client.hSet('all_users', compositeKey, JSON.stringify(userData));
    }
}

export async function removeConnectedUser(chatId: number, botId: string): Promise<void> {
    const compositeKey = `${chatId}:${botId}`;
    await client.hDel('connected_users', compositeKey);
    if (DEBUG) {
        console.log(`[STORAGE] Removed connected user: ${chatId} for bot: ${botId}`);
    }
}

export async function getUserData(chatId: number, botId: string): Promise<UserData | null> {
    const compositeKey = `${chatId}:${botId}`;
    
    // First try connected_users, then fall back to all_users
    const connectedData = await client.hGet('connected_users', compositeKey);
    if (connectedData) {
        return JSON.parse(connectedData);
    }
    
    const allUserData = await client.hGet('all_users', compositeKey);
    return allUserData ? JSON.parse(allUserData) : null;
}

export async function getAllConnectedUsers(botId?: string): Promise<UserData[]> {
    const users = await client.hGetAll('connected_users');
    const parsedUsers = Object.entries(users).map(([key, data]) => {
        const userData = JSON.parse(data);
        // If key doesn't have a botId yet (legacy data), add it from the parsed data or default to 'main'
        if (!key.includes(':')) {
            userData.botId = userData.botId || 'main';
        }
        return userData;
    });
    
    // If botId is provided, filter users by that bot
    return botId ? parsedUsers.filter(user => user.botId === botId) : parsedUsers;
}

/**
 * Get all users who have ever interacted with the bot
 */
export async function getAllTrackedUsers(botId?: string): Promise<UserData[]> {
    const users = await client.hGetAll('all_users');
    const parsedUsers = Object.entries(users).map(([key, data]) => {
        const userData = JSON.parse(data);
        // If key doesn't have a botId yet (legacy data), add it from the parsed data or default to 'main'
        if (!key.includes(':')) {
            userData.botId = userData.botId || 'main';
        }
        return userData;
    });
    
    // If botId is provided, filter users by that bot
    return botId ? parsedUsers.filter(user => user.botId === botId) : parsedUsers;
}

// Transaction submission storage
export interface TransactionSubmission {
    id: string;          // Transaction ID or hash
    userId: number;     // User's chat ID
    botId: string;      // Bot ID the transaction is for
    timestamp: number;  // When the transaction was submitted
    status: 'pending' | 'approved' | 'rejected'; // Status of the transaction
    approvedBy?: number; // Admin who approved/rejected the transaction
    notes?: string;     // Optional notes from admin
}

export async function saveTransactionSubmission(chatId: number, botId: string, transactionId: string): Promise<void> {
    const now = Date.now();
    
    const submission: TransactionSubmission = {
        id: transactionId,
        userId: chatId,
        botId: botId,
        timestamp: now,
        status: 'pending'
    };
    
    await client.hSet('transaction_submissions', transactionId, JSON.stringify(submission));
    if (DEBUG) {
        console.log(`[STORAGE] Saved transaction submission: ${transactionId} from user ${chatId} for bot ${botId}`);
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

export async function getAllPendingTransactions(botId?: string): Promise<TransactionSubmission[]> {
    const transactions = await client.hGetAll('transaction_submissions');
    const pendingTransactions = Object.values(transactions)
        .map(data => {
            const tx = JSON.parse(data);
            // If transaction doesn't have a botId yet (legacy data), default to 'main'
            if (!tx.botId) tx.botId = 'main';
            return tx;
        })
        .filter((submission: TransactionSubmission) => submission.status === 'pending');
    
    // If botId is provided, filter transactions by that bot
    return botId ? pendingTransactions.filter(tx => tx.botId === botId) : pendingTransactions;
}

// Support message system
export interface SupportMessage {
    id: string;           // Message ID (timestamp + random string)
    userId: number;       // User's chat ID
    botId: string;        // Bot ID the message is for
    adminId?: number;     // Admin's chat ID (if response)
    message: string;      // The message content
    timestamp: number;    // When the message was sent
    isResponse: boolean;  // Whether this is a response from admin
}

export async function saveSupportMessage(message: SupportMessage): Promise<void> {
    await client.hSet('support_messages', message.id, JSON.stringify(message));
    // Also add to a user-specific list for quick lookup with bot ID
    await client.sAdd(`support_messages:${message.userId}:${message.botId}`, message.id);
    
    if (DEBUG) {
        console.log(`[STORAGE] Saved support message: ${message.id} from ${message.isResponse ? 'admin' : 'user'} ${message.userId} for bot ${message.botId}`);
    }
}

export async function getSupportMessagesForUser(userId: number, botId: string): Promise<SupportMessage[]> {
    // Get all message IDs for this user and bot
    const messageIds = await client.sMembers(`support_messages:${userId}:${botId}`);
    if (!messageIds.length) {
        // Try the legacy format for backward compatibility
        const legacyMessageIds = await client.sMembers(`support_messages:${userId}`);
        if (!legacyMessageIds.length) return [];
        
        // Get messages and filter by botId if possible
        const messages: SupportMessage[] = [];
        for (const id of legacyMessageIds) {
            const data = await client.hGet('support_messages', id);
            if (data) {
                const msg = JSON.parse(data);
                // Add botId if missing and only include if matches or no botId specified
                if (!msg.botId) msg.botId = 'main';
                if (msg.botId === botId) {
                    messages.push(msg);
                }
            }
        }
        
        return messages.sort((a, b) => a.timestamp - b.timestamp);
    }
    
    // Get all messages for the specific user and bot
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
