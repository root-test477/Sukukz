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
exports.TonConnectStorage = exports.getAnalyticsSummary = exports.trackAnalyticsEvent = exports.getTutorialState = exports.saveTutorialState = exports.saveErrorReport = exports.getSupportMessagesForUser = exports.saveSupportMessage = exports.getSupportMessages = exports.getAllPendingTransactions = exports.updateTransaction = exports.getTransaction = exports.saveTransaction = exports.getTransactionSubmission = exports.updateTransactionStatus = exports.saveTransactionSubmission = exports.getAllTrackedUsers = exports.getAllConnectedUsers = exports.getUserData = exports.removeConnectedUser = exports.updateUserActivity = exports.saveConnectedUser = exports.trackUserInteraction = exports.invalidateWalletCache = exports.getCachedWalletData = exports.getRedisClient = exports.initRedisClient = void 0;
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
/**
 * Get the Redis client instance
 * For use in other modules that need direct access
 */
function getRedisClient() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!client.isOpen) {
            yield client.connect();
        }
        return client;
    });
}
exports.getRedisClient = getRedisClient;
// In-memory wallet cache for better performance
const walletCache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute TTL
/**
 * Cache-enabled wallet data retrieval
 */
function getCachedWalletData(chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        // First check the in-memory cache
        const cached = walletCache.get(chatId);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            if (DEBUG)
                console.log(`[CACHE] Hit for wallet data: ${chatId}`);
            return cached.data;
        }
        // If not in cache or expired, get from Redis
        const key = `${chatId}wallet_info`;
        const data = yield client.get(key);
        if (data) {
            // Update cache
            const parsed = JSON.parse(data);
            walletCache.set(chatId, {
                data: parsed,
                timestamp: Date.now()
            });
            if (DEBUG)
                console.log(`[CACHE] Updated for wallet data: ${chatId}`);
            return parsed;
        }
        return null;
    });
}
exports.getCachedWalletData = getCachedWalletData;
/**
 * Update cache when wallet data changes
 */
function invalidateWalletCache(chatId) {
    walletCache.delete(chatId);
    if (DEBUG)
        console.log(`[CACHE] Invalidated for wallet data: ${chatId}`);
}
exports.invalidateWalletCache = invalidateWalletCache;
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
        const existingUserData = yield client.hGet('all_users', chatId.toString());
        const connectedUserData = yield client.hGet('connected_users', chatId.toString());
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
            yield client.hSet('all_users', chatId.toString(), JSON.stringify(userData));
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
            yield client.hSet('all_users', chatId.toString(), JSON.stringify(userData));
            if (DEBUG) {
                console.log(`[STORAGE] Tracked new user: ${chatId}`);
            }
        }
        // If user already has a wallet connection, make sure they're marked as connected in all_users too
        if (connectedUserData && !existingUserData) {
            const connData = JSON.parse(connectedUserData);
            connData.walletEverConnected = true;
            yield client.hSet('all_users', chatId.toString(), JSON.stringify(connData));
        }
    });
}
exports.trackUserInteraction = trackUserInteraction;
/**
 * Save a user who has connected a wallet
 */
function saveConnectedUser(chatId, walletAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        // Invalidate cache for this user
        invalidateWalletCache(chatId);
        const now = Date.now();
        // Get existing user data if any
        let userData;
        const existingUserData = yield client.hGet('all_users', chatId.toString());
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
        yield client.hSet('connected_users', chatId.toString(), JSON.stringify(userData));
        yield client.hSet('all_users', chatId.toString(), JSON.stringify(userData));
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
            yield client.hSet('connected_users', chatId.toString(), JSON.stringify(userData));
            if (DEBUG) {
                console.log(`[STORAGE] Updated user activity: ${chatId}`);
            }
        }
    });
}
exports.updateUserActivity = updateUserActivity;
function removeConnectedUser(chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Invalidate cache for this user
        invalidateWalletCache(chatId);
        yield client.hDel('connected_users', chatId.toString());
        if (DEBUG) {
            console.log(`[STORAGE] Removed connected user: ${chatId}`);
        }
    });
}
exports.removeConnectedUser = removeConnectedUser;
function getUserData(chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield client.hGet('connected_users', chatId.toString());
        if (data) {
            return JSON.parse(data);
        }
        return null;
    });
}
exports.getUserData = getUserData;
function getAllConnectedUsers() {
    return __awaiter(this, void 0, void 0, function* () {
        const users = yield client.hGetAll('connected_users');
        return Object.values(users).map(userData => JSON.parse(userData));
    });
}
exports.getAllConnectedUsers = getAllConnectedUsers;
/**
 * Get all users who have ever interacted with the bot
 */
function getAllTrackedUsers() {
    return __awaiter(this, void 0, void 0, function* () {
        const users = yield client.hGetAll('all_users');
        return Object.values(users).map(userData => JSON.parse(userData));
    });
}
exports.getAllTrackedUsers = getAllTrackedUsers;
function saveTransactionSubmission(chatId, transactionId, amount = '0', description = '') {
    return __awaiter(this, void 0, void 0, function* () {
        const submission = {
            id: transactionId,
            userId: chatId,
            txId: transactionId,
            amount: amount,
            description: description,
            timestamp: Date.now(),
            status: 'pending'
        };
        yield client.hSet('transaction_submissions', transactionId, JSON.stringify(submission));
        if (DEBUG) {
            console.log(`[STORAGE] Saved transaction submission: ${transactionId} from user ${chatId}`);
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
/**
 * Save a new transaction submission to Redis
 */
function saveTransaction(transaction) {
    return __awaiter(this, void 0, void 0, function* () {
        yield client.hSet(`transaction:${transaction.id}`, {
            userId: transaction.userId.toString(),
            txId: transaction.txId,
            amount: transaction.amount,
            description: transaction.description,
            status: transaction.status,
            timestamp: transaction.timestamp.toString()
        });
        // Also add to user's transaction list
        yield client.sAdd(`user:${transaction.userId}:transactions`, transaction.id);
        // Add to global transaction list by status
        yield client.sAdd(`transactions:${transaction.status}`, transaction.id);
    });
}
exports.saveTransaction = saveTransaction;
/**
 * Get a transaction by ID
 */
function getTransaction(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const transactionData = yield client.hGetAll(`transaction:${id}`);
        if (!transactionData || Object.keys(transactionData).length === 0) {
            return null;
        }
        return {
            id,
            userId: parseInt(transactionData.userId || '0'),
            txId: transactionData.txId || id,
            amount: transactionData.amount || '0',
            description: transactionData.description || '',
            status: (transactionData.status || 'pending'),
            timestamp: parseInt(transactionData.timestamp || '0'),
            reviewedBy: transactionData.reviewedBy ? parseInt(transactionData.reviewedBy) : undefined,
            reviewedAt: transactionData.reviewedAt ? parseInt(transactionData.reviewedAt) : undefined,
            reviewNote: transactionData.reviewNote
        };
    });
}
exports.getTransaction = getTransaction;
/**
 * Update an existing transaction
 */
function updateTransaction(transaction) {
    return __awaiter(this, void 0, void 0, function* () {
        // First remove from status-specific list
        const tx = yield getTransaction(transaction.id);
        if (tx && tx.status !== transaction.status) {
            yield client.sRem(`transactions:${tx.status}`, transaction.id);
            yield client.sAdd(`transactions:${transaction.status}`, transaction.id);
        }
        // Update the transaction data
        yield client.hSet(`transaction:${transaction.id}`, Object.assign(Object.assign(Object.assign({ userId: transaction.userId.toString(), txId: transaction.txId, amount: transaction.amount, description: transaction.description, status: transaction.status, timestamp: transaction.timestamp.toString() }, (transaction.reviewedBy && { reviewedBy: transaction.reviewedBy.toString() })), (transaction.reviewedAt && { reviewedAt: transaction.reviewedAt.toString() })), (transaction.reviewNote && { reviewNote: transaction.reviewNote })));
    });
}
exports.updateTransaction = updateTransaction;
/**
 * Get all pending transactions
 */
function getAllPendingTransactions() {
    return __awaiter(this, void 0, void 0, function* () {
        const pendingIds = yield client.sMembers('transactions:pending');
        const transactions = [];
        for (const id of pendingIds) {
            const tx = yield getTransaction(id);
            if (tx) {
                transactions.push(tx);
            }
        }
        // Sort by timestamp descending (newest first)
        return transactions.sort((a, b) => b.timestamp - a.timestamp);
    });
}
exports.getAllPendingTransactions = getAllPendingTransactions;
/**
 * Get most recent support messages (across all users)
 */
function getSupportMessages(limit = 10) {
    return __awaiter(this, void 0, void 0, function* () {
        // Get all message IDs, sorted by timestamp (most recent first)
        const messageIds = yield client.zRange('support_messages_by_time', 0, limit - 1, { REV: true });
        const messages = [];
        // Get each message
        for (const messageId of messageIds) {
            const messageData = yield client.hGetAll(`support_message:${messageId}`);
            if (messageData && messageData.userId) {
                // Convert Redis hash to SupportMessage object
                const message = {
                    id: messageData.id || messageId.toString(),
                    userId: parseInt(messageData.userId),
                    adminId: messageData.adminId ? parseInt(messageData.adminId) : undefined,
                    message: messageData.message || '',
                    timestamp: parseInt(messageData.timestamp || '0'),
                    isResponse: messageData.isResponse === 'true'
                };
                messages.push(message);
            }
        }
        return messages;
    });
}
exports.getSupportMessages = getSupportMessages;
/**
 * Save a new support message in Redis
 * @param message The support message to save
 */
function saveSupportMessage(message) {
    return __awaiter(this, void 0, void 0, function* () {
        // Save message data in a hash
        yield client.hSet(`support_message:${message.id}`, {
            id: message.id,
            userId: message.userId.toString(),
            adminId: message.adminId ? message.adminId.toString() : '',
            message: message.message,
            timestamp: message.timestamp.toString(),
            isResponse: message.isResponse.toString()
        });
        // Add to user's set of messages
        yield client.sAdd(`support_messages:${message.userId}`, message.id);
        // Add to sorted set for time-based retrieval
        yield client.zAdd('support_messages_by_time', {
            score: message.timestamp,
            value: message.id
        });
        if (DEBUG) {
            console.log(`[STORAGE] Saved support message: ${message.id}`);
        }
    });
}
exports.saveSupportMessage = saveSupportMessage;
// Gets all support messages for a specific user
function getSupportMessagesForUser(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Get all message IDs for this user
        const messageIds = yield client.sMembers(`support_messages:${userId}`);
        if (!messageIds.length)
            return [];
        // Get all messages
        const messages = [];
        for (const messageId of messageIds) {
            const messageData = yield client.hGetAll(`support_message:${messageId}`);
            if (messageData && messageData.userId) {
                // Convert Redis hash to SupportMessage object
                const message = {
                    id: messageData.id || messageId.toString(),
                    userId: parseInt(messageData.userId),
                    adminId: messageData.adminId ? parseInt(messageData.adminId) : undefined,
                    message: messageData.message || '',
                    timestamp: parseInt(messageData.timestamp || '0'),
                    isResponse: messageData.isResponse === 'true'
                };
                messages.push(message);
            }
        }
        // Sort by timestamp
        return messages.sort((a, b) => a.timestamp - b.timestamp);
    });
}
exports.getSupportMessagesForUser = getSupportMessagesForUser;
/**
 * Error Reporting System
 */
// Save an error report to Redis
function saveErrorReport(errorIdOrReport, error, errorType, context) {
    return __awaiter(this, void 0, void 0, function* () {
        // Support both formats - either a complete report object or individual parameters
        if (typeof errorIdOrReport === 'string') {
            // Called with parameters: errorId, error, errorType, context
            const errorId = errorIdOrReport;
            const timestamp = new Date().toISOString();
            const userId = (context === null || context === void 0 ? void 0 : context.userId) || 0;
            const userMessage = (context === null || context === void 0 ? void 0 : context.message) || '';
            const commandName = (context === null || context === void 0 ? void 0 : context.commandName) || errorType || 'unknown';
            // Store individual error report
            yield client.hSet(`error:${errorId || 'unknown'}`, {
                timestamp: timestamp || new Date().toISOString(),
                commandName: commandName || 'unknown',
                userId: userId.toString(),
                userMessage: userMessage || '',
                error: (error === null || error === void 0 ? void 0 : error.message) || 'Unknown error',
                stack: (error === null || error === void 0 ? void 0 : error.stack) || ''
            });
            // Add to sorted set by timestamp for easy retrieval
            yield client.zAdd('error_reports', [{
                    score: new Date(timestamp).getTime(),
                    value: errorId
                }]);
        }
        else {
            // Called with a report object
            const report = errorIdOrReport;
            const id = report.id;
            const timestamp = report.timestamp;
            // Store individual error report
            yield client.hSet(`error:${id}`, {
                timestamp: timestamp,
                commandName: report.commandName,
                userId: report.userId.toString(),
                userMessage: report.userMessage,
                error: report.error,
                stack: report.stack || ''
            });
            // Add to sorted set by timestamp for easy retrieval
            yield client.zAdd('error_reports', [{
                    score: new Date(timestamp).getTime(),
                    value: report.id
                }]);
        }
        // Maintain only the last 100 error reports
        const count = yield client.zCard('error_reports');
        if (count > 100) {
            const toRemove = count - 100;
            const oldestIds = yield client.zRange('error_reports', 0, toRemove - 1);
            if (oldestIds.length > 0) {
                // Remove from sorted set
                yield client.zRem('error_reports', oldestIds);
                // Remove individual error reports
                for (const oldId of oldestIds) {
                    yield client.del(`error:${oldId}`);
                }
            }
        }
        if (DEBUG) {
            console.log(`[STORAGE] Saved error report: ${typeof errorIdOrReport === 'string' ? errorIdOrReport : errorIdOrReport.id}`);
        }
    });
}
exports.saveErrorReport = saveErrorReport;
// Save a user's tutorial state
function saveTutorialState(state) {
    return __awaiter(this, void 0, void 0, function* () {
        yield client.hSet('tutorial_states', state.userId.toString(), JSON.stringify(state));
        if (DEBUG) {
            console.log(`[STORAGE] Saved tutorial state for user: ${state.userId}, step: ${state.currentStep}`);
        }
    });
}
exports.saveTutorialState = saveTutorialState;
// Get a user's tutorial state
function getTutorialState(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield client.hGet('tutorial_states', userId.toString());
        return data ? JSON.parse(data) : null;
    });
}
exports.getTutorialState = getTutorialState;
/**
 * Analytics Storage
 */
// Track a specific analytics event
function trackAnalyticsEvent(eventType, userId, metadata) {
    return __awaiter(this, void 0, void 0, function* () {
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
        yield client.hSet('analytics_events', eventId, JSON.stringify(event));
        // Add to sorted set by timestamp
        yield client.zAdd('analytics_events_by_time', [{
                score: timestamp,
                value: eventId
            }]);
        // Add to set of events by type
        yield client.sAdd(`analytics_events:${eventType}`, eventId);
        // Add to set of events by user
        yield client.sAdd(`analytics_events:user:${userId}`, eventId);
        if (DEBUG) {
            console.log(`[ANALYTICS] Tracked ${eventType} for user ${userId}`);
        }
    });
}
exports.trackAnalyticsEvent = trackAnalyticsEvent;
// Get analytics counts for dashboard
function getAnalyticsSummary() {
    return __awaiter(this, void 0, void 0, function* () {
        // Get total users
        const totalUsers = yield client.hLen('all_users');
        // Get connected wallet users
        const connectedUsers = yield client.hLen('connected_users');
        // Get active users in last 24 hours
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        const allUsersData = yield client.hGetAll('all_users');
        const activeUsers = Object.values(allUsersData)
            .map(data => JSON.parse(data))
            .filter((userData) => userData.lastActivity > oneDayAgo)
            .length;
        // Get transaction counts
        const transactions = yield client.hGetAll('transaction_submissions');
        const transactionCount = Object.keys(transactions).length;
        // Count by status
        const pendingTransactions = Object.values(transactions)
            .map(data => JSON.parse(data))
            .filter((tx) => tx.status === 'pending')
            .length;
        const approvedTransactions = Object.values(transactions)
            .map(data => JSON.parse(data))
            .filter((tx) => tx.status === 'approved')
            .length;
        const rejectedTransactions = Object.values(transactions)
            .map(data => JSON.parse(data))
            .filter((tx) => tx.status === 'rejected')
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