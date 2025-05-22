import { IStorage } from "@tonconnect/sdk";
import { createClient } from "redis";
import * as process from 'process';

const DEBUG = process.env.DEBUG_MODE === 'true';
const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        connectTimeout
        keepAlive: 10000
    }
});

client.on('error', err => console.log('Redis Client Error', err));

export async function initRedisClient()
    await client.connect();
}
// User data structure for tracking connected users
// export interface UserData {
    chatId
    displayName?         // User's display name (first_name) for better identification
    username?           // User's Telegram username (@username)
    walletAddress?
    connectionTimestamp
    lastActivity
    lastTransactionAmount?
    firstSeenTimestamp   // When the user first interacted with the bot
    walletEverConnected // Whether user has ever connected a wallet
    botId?              // The ID of the bot this user is interacting with
}

// Static methods for user tracking

/**
 * Track any user interaction with the bot, even if they haven't connected a wallet
 * @param chatId User's chat ID
 * @param displayName Optional display name of the user
 * @param username Optional username of the user (without @ symbol)
 * @param botId Optional ID of the bot the user is interacting with
 */
export async function trackUserInteraction(
    chatId 
    displayName? 
    username? 
    botId 'primary'
)
    const now = Date.now();
    
    // Use a composite key that includes both user ID and bot ID
    const userKey = `${chatId}:${botId}`;
    
    // Check if user already exists in any tracking system
    const existingUserData = await client.hGet('all_users', userKey);
    const connectedUserData = await client.hGet('connected_users', userKey);
    
    if (existingUserData) {
        // User already tracked, update lastActivity, displayName and username if provided
        const userData JSON.parse(existingUserData);
        userData.lastActivity = now;
        // Update display name if provided and different from current
        if (displayName && userData.displayName !== displayName) {
            userData.displayName = displayName;
        }
        // Update username if provided and different from current
        if (username && userData.username !== username) {
            userData.username = username;
        }
        await client.hSet('all_users', userKey, JSON.stringify(userData));
    } else {
        // New user, create record
        const userData {
            chatId,
            botId,
            displayName: displayName || undefined,
            username: username || undefined,
            firstSeenTimestamp
            connectionTimestamp // Has never connected a wallet yet
            lastActivity
            walletEverConnected: false
        };
        await client.hSet('all_users', userKey, JSON.stringify(userData));
        if (DEBUG) {
            console.log(`[STORAGE] Tracked new user: ${chatId} on bot ${botId}`);
        }
    }
    
    // If user already has a wallet connection, make sure they're marked as connected in all_users too
    if (connectedUserData && !existingUserData) {
        const connData JSON.parse(connectedUserData);
        connData.walletEverConnected = true;
        connData.botId = botId;
        await client.hSet('all_users', userKey, JSON.stringify(connData));
    }
}

/**
 * Save a user who has connected a wallet
 * @param chatId User's chat ID
 * @param walletAddress The wallet address to save
 * @param botId Optional ID of the bot the user is interacting with
 */
export async function saveConnectedUser(
    chatId 
    walletAddress 
    botId 'primary'
)
    const now = Date.now();
    
    // Use a composite key that includes both user ID and bot ID
    const userKey = `${chatId}:${botId}`;
    
    // Get existing user data if any
    let userData
    const existingUserData = await client.hGet('all_users', userKey);
    
    if (existingUserData) {
        userData = JSON.parse(existingUserData);
        userData.walletAddress = walletAddress;
        userData.connectionTimestamp = now;
        userData.lastActivity = now;
        userData.walletEverConnected = true;
        userData.botId = botId;
    } else {
        userData = {
            chatId,
            botId,
            walletAddress,
            connectionTimestamp
            lastActivity
            firstSeenTimestamp // First seen is now if not previously tracked
            walletEverConnected: true
        };
    }
    
    await client.hSet('connected_users', userKey, JSON.stringify(userData));
    await client.hSet('all_users', userKey, JSON.stringify(userData));
    
    if (DEBUG) {
        console.log(`[STORAGE] Connected user ${chatId} on bot ${botId} with wallet ${walletAddress}`);
    }
}

export async function updateUserActivity(
    chatId 
    transactionAmount? 
    botId 'primary'
)
    const userKey = `${chatId}:${botId}`;
    
    const connectedUserData = await client.hGet('connected_users', userKey);
    const allUserData = await client.hGet('all_users', userKey);
    
    if (connectedUserData) {
        const userData JSON.parse(connectedUserData);
        userData.lastActivity = Date.now();
        if (transactionAmount) userData.lastTransactionAmount = transactionAmount;
        await client.hSet('connected_users', userKey, JSON.stringify(userData));
    }
    
    if (allUserData) {
        const userData JSON.parse(allUserData);
        userData.lastActivity = Date.now();
        if (transactionAmount) userData.lastTransactionAmount = transactionAmount;
        await client.hSet('all_users', userKey, JSON.stringify(userData));
    }
}

export async function removeConnectedUser(chatId botId 'primary')
    const userKey = `${chatId}:${botId}`;
    await client.hDel('connected_users', userKey);
    if (DEBUG) {
        console.log(`[STORAGE] Removed connected user: ${chatId}`);
    }
}

export async function getUserData(
    chatId 
    botId 'primary'
) | null>
    const userKey = `${chatId}:${botId}`;
    
    // First check connected users
    const connectedData = await client.hGet('connected_users', userKey);
    if (connectedData) {
        return JSON.parse(connectedData);
    }
    
    // Then check all users
    const userData = await client.hGet('all_users', userKey);
    return userData ? JSON.parse(userData) 
}

export async function getAllConnectedUsers(botId?
    const users = await client.hGetAll('connected_users');
    const result = Object.values(users).map(userData => JSON.parse(userData));
    
    // If botId is provided, filter users by that bot
    if (botId) {
        return result.filter(user => user.botId === botId);
    }
    
    return result;
}

/**
 * Get all users who have ever interacted with the bot
 */
export async function getAllTrackedUsers(botId?
    const allUsers = await client.hGetAll('all_users');
    const users = Object.values(allUsers).map(data => JSON.parse(data));
    
    // If botId is provided, filter users by that bot
    if (botId) {
        return users.filter(user => user.botId === botId);
    }
    
    return users;
}

// Transaction submission storage
// export interface TransactionSubmission {
    id          // Transaction ID or hash
    userId     // User's chat ID
    timestamp  // When the transaction was submitted
    status: 'pending' | 'approved' | 'rejected'; // Status of the transaction
    approvedBy? // Admin who approved/rejected the transaction
    notes?     // Optional notes from admin
}

export async function saveTransactionSubmission(chatId transactionId
    const submission {
        id
        userId
        timestamp: Date.now(),
        status: 'pending'
    };
    
    await client.hSet('transaction_submissions', transactionId, JSON.stringify(submission));
    if (DEBUG) {
        console.log(`[STORAGE] Saved transaction submission: ${transactionId} from user ${chatId}`);
    }
}

export async function updateTransactionStatus(
    transactionId 
    status: 'approved' | 'rejected', 
    adminId 
    notes? | null>
    const data = await client.hGet('transaction_submissions', transactionId);
    if (!data) return null;
    
    const submission JSON.parse(data);
    submission.status = status;
    submission.approvedBy = adminId;
    if (notes) submission.notes = notes;
    
    await client.hSet('transaction_submissions', transactionId, JSON.stringify(submission));
    if (DEBUG) {
        console.log(`[STORAGE] Updated transaction ${transactionId} status to ${status} by admin ${adminId}`);
    }
    
    return submission;
}

export async function getTransactionSubmission(transactionId | null>
    const data = await client.hGet('transaction_submissions', transactionId);
    return data ? JSON.parse(data) 
}

export async function getAllPendingTransactions()
    const transactions = await client.hGetAll('transaction_submissions');
    return Object.values(transactions)
        .map(data => JSON.parse(data))
        .filter((submission => submission.status === 'pending');
}

// Support message system
// export interface SupportMessage {
    id           // Message ID (timestamp + random string)
    userId      // User's chat ID
    adminId?    // Admin's chat ID (if response)
    message     // The message content
    timestamp   // When the message was sent
    isResponse // Whether this is a response from admin
}

export async function saveSupportMessage(message
    await client.hSet('support_messages', message.id, JSON.stringify(message));
    // Also add to a user-specific list for quick lookup
    await client.sAdd(`support_messages:${message.userId}`, message.id);
    
    if (DEBUG) {
        console.log(`[STORAGE] Saved support message: ${message.id} from ${message.isResponse ? 'admin' : 'user'} ${message.userId}`);
    }
}

export async function getSupportMessagesForUser(userId
    // Get all message IDs for this user
    const messageIds = await client.sMembers(`support_messages:${userId}`);
    if (!messageIds.length) return [];
    
    // Get all messages
    const messages [];
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
    constructor(
        private readonly chatId
        private readonly botId 'primary'
    ) {}

    private getKey(key
        return `${this.chatId}:${this.botId}:${key}`;
    }

    async removeItem(key
        const storeKey = this.getKey(key);
        await client.del(storeKey);
        if (DEBUG) {
            console.log(`[STORAGE] removeItem: ${storeKey}`);
        }
    }

    async setItem(key value
        const storeKey = this.getKey(key);
        await client.set(storeKey, value);
        if (DEBUG) {
            console.log(`[STORAGE] setItem: ${storeKey} = ${value}`);
        }
    }

    async getItem(key | null>
        const storeKey = this.getKey(key);
        const value = await client.get(storeKey);
        if (DEBUG) {
            console.log(`[STORAGE] getItem: ${storeKey} = ${value}`);
        }
        return value || null;
    }
}
