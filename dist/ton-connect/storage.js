"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TonConnectStorage = exports.getSupportMessagesForUser = exports.saveSupportMessage = exports.getAllPendingTransactions = exports.getTransactionSubmission = exports.updateTransactionStatus = exports.saveTransactionSubmission = exports.getAllTrackedUsers = exports.getAllConnectedUsers = exports.getUserData = exports.removeConnectedUser = exports.updateUserActivity = exports.saveConnectedUser = exports.trackUserInteraction = exports.initRedisClient = void 0;
const redis_1 = require("redis");
const process = __importStar(require("process"));
const DEBUG = process.env.DEBUG_MODE === 'true';
const client = (0, redis_1.createClient)({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        connectTimeout: 10000,
        keepAlive: 10000
    }
});
client.on('error', err => console.log('Redis Client Error', err));
function initRedisClient() {
    return __awaiter(this, void 0, void 0, function* () {
        yield client.connect();
    });
}
exports.initRedisClient = initRedisClient;
// Static methods for user tracking
/**
 * Track any user interaction with the bot, even if they haven't connected a wallet
 * @param chatId User's chat ID
 * @param botId Bot ID the user is interacting with
 * @param displayName Optional display name of the user
 * @param username Optional username of the user (without @ symbol)
 */
function trackUserInteraction(chatId, botId, displayName, username) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = Date.now();
        const compositeKey = `${chatId}:${botId}`;
        // Check if user already exists in any tracking system
        const existingUserData = yield client.hGet('all_users', compositeKey);
        const connectedUserData = yield client.hGet('connected_users', compositeKey);
        if (existingUserData) {
            // User already tracked, update lastActivity, displayName and username if provided
            const userData = JSON.parse(existingUserData);
            userData.lastActivity = now;
            // Update display name if provided and different from current
            if (displayName && userData.displayName !== displayName) {
                userData.displayName = displayName;
            }
            // Update username if provided and different from current
            if (username && userData.username !== username) {
                userData.username = username;
            }
            yield client.hSet('all_users', compositeKey, JSON.stringify(userData));
        }
        else {
            // New user, create record
            const userData = {
                chatId,
                botId,
                displayName: displayName || undefined,
                username: username || undefined,
                firstSeenTimestamp: now,
                connectionTimestamp: 0,
                lastActivity: now,
                walletEverConnected: false
            };
            yield client.hSet('all_users', compositeKey, JSON.stringify(userData));
            if (DEBUG) {
                console.log(`[STORAGE] Tracked new user: ${chatId} for bot: ${botId}`);
            }
        }
        // If user already has a wallet connection, make sure they're marked as connected in all_users too
        if (connectedUserData && !existingUserData) {
            const connData = JSON.parse(connectedUserData);
            connData.walletEverConnected = true;
            yield client.hSet('all_users', compositeKey, JSON.stringify(connData));
        }
    });
}
exports.trackUserInteraction = trackUserInteraction;
/**
 * Save a user who has connected a wallet
 * @param chatId User's chat ID
 * @param botId Bot ID the user is interacting with
 * @param walletAddress User's wallet address
 */
function saveConnectedUser(chatId, botId, walletAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = Date.now();
        const compositeKey = `${chatId}:${botId}`;
        // Get existing user data if any
        let userData;
        const existingUserData = yield client.hGet('all_users', compositeKey);
        if (existingUserData) {
            userData = JSON.parse(existingUserData);
            userData.walletAddress = walletAddress;
            userData.connectionTimestamp = now;
            userData.lastActivity = now;
            userData.walletEverConnected = true;
        }
        else {
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
        yield client.hSet('connected_users', compositeKey, JSON.stringify(userData));
        yield client.hSet('all_users', compositeKey, JSON.stringify(userData));
        if (DEBUG) {
            console.log(`[STORAGE] Saved connected user: ${chatId} for bot: ${botId} with wallet: ${walletAddress}`);
        }
    });
}
exports.saveConnectedUser = saveConnectedUser;
function updateUserActivity(chatId, botId, transactionAmount) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = Date.now();
        const compositeKey = `${chatId}:${botId}`;
        // Update in connected_users if exists
        const connectedData = yield client.hGet('connected_users', compositeKey);
        if (connectedData) {
            const userData = JSON.parse(connectedData);
            userData.lastActivity = now;
            if (transactionAmount) {
                userData.lastTransactionAmount = transactionAmount;
            }
            yield client.hSet('connected_users', compositeKey, JSON.stringify(userData));
        }
        // Always update in all_users
        const allUserData = yield client.hGet('all_users', compositeKey);
        if (allUserData) {
            const userData = JSON.parse(allUserData);
            userData.lastActivity = now;
            if (transactionAmount) {
                userData.lastTransactionAmount = transactionAmount;
            }
            yield client.hSet('all_users', compositeKey, JSON.stringify(userData));
        }
    });
}
exports.updateUserActivity = updateUserActivity;
function removeConnectedUser(chatId, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const compositeKey = `${chatId}:${botId}`;
        yield client.hDel('connected_users', compositeKey);
        if (DEBUG) {
            console.log(`[STORAGE] Removed connected user: ${chatId} for bot: ${botId}`);
        }
    });
}
exports.removeConnectedUser = removeConnectedUser;
function getUserData(chatId, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const compositeKey = `${chatId}:${botId}`;
        // First try connected_users, then fall back to all_users
        const connectedData = yield client.hGet('connected_users', compositeKey);
        if (connectedData) {
            return JSON.parse(connectedData);
        }
        const allUserData = yield client.hGet('all_users', compositeKey);
        return allUserData ? JSON.parse(allUserData) : null;
    });
}
exports.getUserData = getUserData;
function getAllConnectedUsers(botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const users = yield client.hGetAll('connected_users');
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
    });
}
exports.getAllConnectedUsers = getAllConnectedUsers;
/**
 * Get all users who have ever interacted with the bot
 */
function getAllTrackedUsers(botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const users = yield client.hGetAll('all_users');
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
    });
}
exports.getAllTrackedUsers = getAllTrackedUsers;
function saveTransactionSubmission(chatId, botId, transactionId) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = Date.now();
        const submission = {
            id: transactionId,
            userId: chatId,
            botId: botId,
            timestamp: now,
            status: 'pending'
        };
        yield client.hSet('transaction_submissions', transactionId, JSON.stringify(submission));
        if (DEBUG) {
            console.log(`[STORAGE] Saved transaction submission: ${transactionId} from user ${chatId} for bot ${botId}`);
        }
    });
}
exports.saveTransactionSubmission = saveTransactionSubmission;
function updateTransactionStatus(transactionId, status, adminId, notes) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield client.hGet('transaction_submissions', transactionId);
        if (!data)
            return null;
        const submission = JSON.parse(data);
        submission.status = status;
        submission.approvedBy = adminId;
        if (notes)
            submission.notes = notes;
        yield client.hSet('transaction_submissions', transactionId, JSON.stringify(submission));
        if (DEBUG) {
            console.log(`[STORAGE] Updated transaction ${transactionId} status to ${status} by admin ${adminId}`);
        }
        return submission;
    });
}
exports.updateTransactionStatus = updateTransactionStatus;
function getTransactionSubmission(transactionId) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield client.hGet('transaction_submissions', transactionId);
        return data ? JSON.parse(data) : null;
    });
}
exports.getTransactionSubmission = getTransactionSubmission;
function getAllPendingTransactions(botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const transactions = yield client.hGetAll('transaction_submissions');
        const pendingTransactions = Object.values(transactions)
            .map(data => {
            const tx = JSON.parse(data);
            // If transaction doesn't have a botId yet (legacy data), default to 'main'
            if (!tx.botId)
                tx.botId = 'main';
            return tx;
        })
            .filter((submission) => submission.status === 'pending');
        // If botId is provided, filter transactions by that bot
        return botId ? pendingTransactions.filter(tx => tx.botId === botId) : pendingTransactions;
    });
}
exports.getAllPendingTransactions = getAllPendingTransactions;
function saveSupportMessage(message) {
    return __awaiter(this, void 0, void 0, function* () {
        yield client.hSet('support_messages', message.id, JSON.stringify(message));
        // Also add to a user-specific list for quick lookup with bot ID
        yield client.sAdd(`support_messages:${message.userId}:${message.botId}`, message.id);
        if (DEBUG) {
            console.log(`[STORAGE] Saved support message: ${message.id} from ${message.isResponse ? 'admin' : 'user'} ${message.userId} for bot ${message.botId}`);
        }
    });
}
exports.saveSupportMessage = saveSupportMessage;
function getSupportMessagesForUser(userId, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Get all message IDs for this user and bot
        const messageIds = yield client.sMembers(`support_messages:${userId}:${botId}`);
        if (!messageIds.length) {
            // Try the legacy format for backward compatibility
            const legacyMessageIds = yield client.sMembers(`support_messages:${userId}`);
            if (!legacyMessageIds.length)
                return [];
            // Get messages and filter by botId if possible
            const messages = [];
            for (const id of legacyMessageIds) {
                const data = yield client.hGet('support_messages', id);
                if (data) {
                    const msg = JSON.parse(data);
                    // Add botId if missing and only include if matches or no botId specified
                    if (!msg.botId)
                        msg.botId = 'main';
                    if (msg.botId === botId) {
                        messages.push(msg);
                    }
                }
            }
            return messages.sort((a, b) => a.timestamp - b.timestamp);
        }
        // Get all messages for the specific user and bot
        const messages = [];
        for (const id of messageIds) {
            const data = yield client.hGet('support_messages', id);
            if (data) {
                messages.push(JSON.parse(data));
            }
        }
        // Sort by timestamp
        return messages.sort((a, b) => a.timestamp - b.timestamp);
    });
}
exports.getSupportMessagesForUser = getSupportMessagesForUser;
class TonConnectStorage {
    constructor(chatId, botId) {
        this.chatId = chatId;
        this.botId = botId;
    }
    getKey(key) {
        return `${this.chatId}:${this.botId}:${key}`;
    }
    removeItem(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const storeKey = this.getKey(key);
            yield client.del(storeKey);
            if (DEBUG) {
                console.log(`[STORAGE] removeItem: ${storeKey}`);
            }
        });
    }
    setItem(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const storeKey = this.getKey(key);
            yield client.set(storeKey, value);
            if (DEBUG) {
                console.log(`[STORAGE] setItem: ${storeKey} = ${value}`);
            }
        });
    }
    getItem(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const storeKey = this.getKey(key);
            const value = yield client.get(storeKey);
            if (DEBUG) {
                console.log(`[STORAGE] getItem: ${storeKey} = ${value}`);
            }
            return value || null;
        });
    }
}
exports.TonConnectStorage = TonConnectStorage;
//# sourceMappingURL=storage.js.map