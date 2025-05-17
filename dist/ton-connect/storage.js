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
exports.TonConnectStorage = exports.getAnalyticsSummary = exports.getRedisClient = exports.saveErrorReport = exports.updateTransaction = exports.getTransaction = exports.saveTransaction = exports.getTutorialState = exports.saveTutorialState = exports.getSupportMessages = exports.getSupportMessagesForUser = exports.saveSupportMessage = exports.getAllPendingTransactions = exports.getTransactionSubmission = exports.updateTransactionStatus = exports.saveTransactionSubmission = exports.getAllTrackedUsers = exports.getAllConnectedUsers = exports.getUserData = exports.removeConnectedUser = exports.updateUserActivity = exports.saveConnectedUser = exports.trackUserInteraction = exports.initRedisClient = exports.client = void 0;
const redis_1 = require("redis");
const process = __importStar(require("process"));
const DEBUG = process.env.DEBUG_MODE === 'true';
// Export client so it can be used in other files
exports.client = (0, redis_1.createClient)({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        connectTimeout: 10000,
        keepAlive: 10000
    }
});
exports.client.on('error', err => console.log('Redis Client Error', err));
function initRedisClient() {
    return __awaiter(this, void 0, void 0, function* () {
        yield exports.client.connect();
    });
}
exports.initRedisClient = initRedisClient;
// Static methods for user tracking
/**
 * Track any user interaction with the bot, even if they haven't connected a wallet
 * @param chatId User's chat ID
 * @param displayName Optional display name of the user
 * @param username Optional username of the user (without @ symbol)
 */
function trackUserInteraction(chatId, displayName, username) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = Date.now();
        // Check if user already exists in any tracking system
        const existingUserData = yield exports.client.hGet('all_users', chatId.toString());
        const connectedUserData = yield exports.client.hGet('connected_users', chatId.toString());
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
            yield exports.client.hSet('all_users', chatId.toString(), JSON.stringify(userData));
        }
        else {
            // New user, create record
            const userData = {
                chatId,
                displayName: displayName || undefined,
                username: username || undefined,
                firstSeenTimestamp: now,
                connectionTimestamp: 0,
                lastActivity: now,
                walletEverConnected: false
            };
            yield exports.client.hSet('all_users', chatId.toString(), JSON.stringify(userData));
            if (DEBUG) {
                console.log(`[STORAGE] Tracked new user: ${chatId}`);
            }
        }
        // If user already has a wallet connection, make sure they're marked as connected in all_users too
        if (connectedUserData && !existingUserData) {
            const connData = JSON.parse(connectedUserData);
            connData.walletEverConnected = true;
            yield exports.client.hSet('all_users', chatId.toString(), JSON.stringify(connData));
        }
    });
}
exports.trackUserInteraction = trackUserInteraction;
/**
 * Save a user who has connected a wallet
 */
function saveConnectedUser(chatId, walletAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = Date.now();
        // Get existing user data if any
        let userData;
        const existingUserData = yield exports.client.hGet('all_users', chatId.toString());
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
                walletAddress,
                connectionTimestamp: now,
                lastActivity: now,
                firstSeenTimestamp: now,
                walletEverConnected: true
            };
        }
        // Update both connected_users and all_users
        yield exports.client.hSet('connected_users', chatId.toString(), JSON.stringify(userData));
        yield exports.client.hSet('all_users', chatId.toString(), JSON.stringify(userData));
        if (DEBUG) {
            console.log(`[STORAGE] Saved connected user: ${chatId} with wallet ${walletAddress}`);
        }
    });
}
exports.saveConnectedUser = saveConnectedUser;
function updateUserActivity(chatId, transactionAmount) {
    return __awaiter(this, void 0, void 0, function* () {
        const userData = yield getUserData(chatId);
        if (userData) {
            userData.lastActivity = Date.now();
            if (transactionAmount) {
                userData.lastTransactionAmount = transactionAmount;
            }
            yield exports.client.hSet('connected_users', chatId.toString(), JSON.stringify(userData));
            if (DEBUG) {
                console.log(`[STORAGE] Updated user activity: ${chatId}`);
            }
        }
    });
}
exports.updateUserActivity = updateUserActivity;
function removeConnectedUser(chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield exports.client.hDel('connected_users', chatId.toString());
        if (DEBUG) {
            console.log(`[STORAGE] Removed connected user: ${chatId}`);
        }
    });
}
exports.removeConnectedUser = removeConnectedUser;
function getUserData(chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield exports.client.hGet('connected_users', chatId.toString());
        if (data) {
            return JSON.parse(data);
        }
        return null;
    });
}
exports.getUserData = getUserData;
function getAllConnectedUsers() {
    return __awaiter(this, void 0, void 0, function* () {
        const users = yield exports.client.hGetAll('connected_users');
        return Object.values(users).map(userData => JSON.parse(userData));
    });
}
exports.getAllConnectedUsers = getAllConnectedUsers;
/**
 * Get all users who have ever interacted with the bot
 */
function getAllTrackedUsers() {
    return __awaiter(this, void 0, void 0, function* () {
        const users = yield exports.client.hGetAll('all_users');
        return Object.values(users).map(userData => JSON.parse(userData));
    });
}
exports.getAllTrackedUsers = getAllTrackedUsers;
function saveTransactionSubmission(chatId, transactionId) {
    return __awaiter(this, void 0, void 0, function* () {
        const submission = {
            id: transactionId,
            userId: chatId,
            timestamp: Date.now(),
            status: 'pending'
        };
        yield exports.client.hSet('transaction_submissions', transactionId, JSON.stringify(submission));
        if (DEBUG) {
            console.log(`[STORAGE] Saved transaction submission: ${transactionId} from user ${chatId}`);
        }
    });
}
exports.saveTransactionSubmission = saveTransactionSubmission;
function updateTransactionStatus(transactionId, status, adminId, notes) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield exports.client.hGet('transaction_submissions', transactionId);
        if (!data)
            return null;
        const submission = JSON.parse(data);
        submission.status = status;
        submission.approvedBy = adminId;
        if (notes)
            submission.notes = notes;
        yield exports.client.hSet('transaction_submissions', transactionId, JSON.stringify(submission));
        if (DEBUG) {
            console.log(`[STORAGE] Updated transaction ${transactionId} status to ${status} by admin ${adminId}`);
        }
        return submission;
    });
}
exports.updateTransactionStatus = updateTransactionStatus;
function getTransactionSubmission(transactionId) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield exports.client.hGet('transaction_submissions', transactionId);
        return data ? JSON.parse(data) : null;
    });
}
exports.getTransactionSubmission = getTransactionSubmission;
function getAllPendingTransactions() {
    return __awaiter(this, void 0, void 0, function* () {
        const transactions = yield exports.client.hGetAll('transaction_submissions');
        return Object.values(transactions)
            .map(data => JSON.parse(data))
            .filter((submission) => submission.status === 'pending');
    });
}
exports.getAllPendingTransactions = getAllPendingTransactions;
function saveSupportMessage(message) {
    return __awaiter(this, void 0, void 0, function* () {
        yield exports.client.hSet('support_messages', message.id, JSON.stringify(message));
        // Also add to a user-specific list for quick lookup
        yield exports.client.sAdd(`support_messages:${message.userId}`, message.id);
        if (DEBUG) {
            console.log(`[STORAGE] Saved support message: ${message.id} from ${message.isResponse ? 'admin' : 'user'} ${message.userId}`);
        }
    });
}
exports.saveSupportMessage = saveSupportMessage;
function getSupportMessagesForUser(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Get all message IDs for this user
        const messageIds = yield exports.client.sMembers(`support_messages:${userId}`);
        if (!messageIds.length)
            return [];
        // Get all messages
        const messages = [];
        for (const id of messageIds) {
            const data = yield exports.client.hGet('support_messages', id);
            if (data) {
                messages.push(JSON.parse(data));
            }
        }
        // Sort by timestamp
        return messages.sort((a, b) => a.timestamp - b.timestamp);
    });
}
exports.getSupportMessagesForUser = getSupportMessagesForUser;
// Alias for backward compatibility
exports.getSupportMessages = getSupportMessagesForUser;
/**
 * Save tutorial state for a user
 * @param state Tutorial state data
 */
function saveTutorialState(state) {
    return __awaiter(this, void 0, void 0, function* () {
        const userId = state.userId || state.chatId;
        yield exports.client.hSet('tutorial_progress', userId.toString(), JSON.stringify(state));
        if (DEBUG) {
            console.log(`[STORAGE] Saved tutorial state for user ${userId}: Step ${state.currentStep}`);
        }
    });
}
exports.saveTutorialState = saveTutorialState;
/**
 * Get tutorial state for a user
 * @param chatId User's chat ID
 * @returns Tutorial state or null if not found
 */
function getTutorialState(chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield exports.client.hGet('tutorial_progress', chatId.toString());
        if (!data)
            return null;
        return JSON.parse(data);
    });
}
exports.getTutorialState = getTutorialState;
/**
 * Save a transaction to the database
 * @param userId User's chat ID
 * @param transactionId Transaction ID
 * @param amount Optional transaction amount
 * @param description Optional transaction description
 */
function saveTransaction(userId, transactionId, amount, description) {
    return __awaiter(this, void 0, void 0, function* () {
        const transaction = {
            id: transactionId,
            userId,
            timestamp: Date.now(),
            status: 'pending',
            amount,
            description
        };
        yield exports.client.hSet('transactions', transactionId, JSON.stringify(transaction));
        if (DEBUG) {
            console.log(`[STORAGE] Saved transaction ${transactionId} for user ${userId}`);
        }
    });
}
exports.saveTransaction = saveTransaction;
/**
 * Get a transaction by ID
 * @param transactionId Transaction ID
 */
function getTransaction(transactionId) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield exports.client.hGet('transactions', transactionId);
        return data ? JSON.parse(data) : null;
    });
}
exports.getTransaction = getTransaction;
/**
 * Update a transaction
 * @param transactionId Transaction ID
 * @param updates Fields to update
 */
function updateTransaction(transactionId, updates) {
    return __awaiter(this, void 0, void 0, function* () {
        const transaction = yield getTransaction(transactionId);
        if (!transaction)
            return null;
        const updated = Object.assign(Object.assign({}, transaction), updates);
        yield exports.client.hSet('transactions', transactionId, JSON.stringify(updated));
        if (DEBUG) {
            console.log(`[STORAGE] Updated transaction ${transactionId}`);
        }
        return updated;
    });
}
exports.updateTransaction = updateTransaction;
/**
 * Save error report
 * @param error Error report
 */
function saveErrorReport(error) {
    return __awaiter(this, void 0, void 0, function* () {
        const id = `error_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        yield exports.client.hSet('error_reports', id, JSON.stringify(error));
        if (DEBUG) {
            console.log(`[STORAGE] Saved error report: ${id} - ${error.message}`);
        }
    });
}
exports.saveErrorReport = saveErrorReport;
/**
 * Get Redis client (for direct access in other modules)
 */
function getRedisClient() {
    return exports.client;
}
exports.getRedisClient = getRedisClient;
/**
 * Get analytics summary for admin dashboard
 */
function getAnalyticsSummary() {
    return __awaiter(this, void 0, void 0, function* () {
        const allUsers = yield getAllTrackedUsers();
        const connectedUsers = yield getAllConnectedUsers();
        return {
            totalUsers: allUsers.length,
            activeUsers: connectedUsers.length,
            inactiveUsers: allUsers.length - connectedUsers.length,
            userActivity: allUsers.map(user => ({
                chatId: user.chatId,
                displayName: user.displayName,
                username: user.username,
                lastActivity: user.lastActivity,
                connected: !!user.walletAddress
            }))
        };
    });
}
exports.getAnalyticsSummary = getAnalyticsSummary;
class TonConnectStorage {
    constructor(chatId) {
        this.chatId = chatId;
    }
    getKey(key) {
        return this.chatId.toString() + key;
    }
    removeItem(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const storeKey = this.getKey(key);
            yield exports.client.del(storeKey);
            if (DEBUG) {
                console.log(`[STORAGE] removeItem: ${storeKey}`);
            }
        });
    }
    setItem(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const storeKey = this.getKey(key);
            yield exports.client.set(storeKey, value);
            if (DEBUG) {
                console.log(`[STORAGE] setItem: ${storeKey} = ${value}`);
            }
        });
    }
    getItem(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const storeKey = this.getKey(key);
            const value = yield exports.client.get(storeKey);
            if (DEBUG) {
                console.log(`[STORAGE] getItem: ${storeKey} = ${value}`);
            }
            return value || null;
        });
    }
}
exports.TonConnectStorage = TonConnectStorage;
//# sourceMappingURL=storage.js.map