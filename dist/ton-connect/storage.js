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
exports.TonConnectStorage = exports.getSupportMessagesForUser = exports.saveSupportMessage = exports.clearTestResults = exports.getTestResults = exports.saveTestResult = exports.getAllPendingTransactions = exports.getTransactionSubmission = exports.updateTransactionStatus = exports.saveTransactionSubmission = exports.getUserLanguage = exports.setUserLanguage = exports.getAllTrackedUsers = exports.getAllConnectedUsers = exports.getUserData = exports.removeConnectedUser = exports.updateUserActivity = exports.saveConnectedUser = exports.trackUserInteraction = exports.initRedisClient = void 0;
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
        const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
        // Log Redis connection attempt
        console.log(`[REDIS] Attempting to connect to Redis at ${redisUrl}`);
        try {
            yield client.connect();
            // Test the Redis connection
            const pingResult = yield client.ping();
            console.log(`[REDIS] Connection successful. Ping response: ${pingResult}`);
            console.log(`[REDIS] Connected to Redis at ${redisUrl}`);
        }
        catch (error) {
            console.error('[REDIS] Connection failed:', error);
            throw error; // Rethrow to allow handling by the calling code
        }
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
/**
 * Set a user's language preference
 */
function setUserLanguage(chatId, languageCode) {
    return __awaiter(this, void 0, void 0, function* () {
        // First check if user exists in tracking
        const existingUserData = yield client.hGet('all_users', chatId.toString());
        if (existingUserData) {
            const userData = JSON.parse(existingUserData);
            userData.languagePreference = languageCode;
            yield client.hSet('all_users', chatId.toString(), JSON.stringify(userData));
        }
        else {
            // Create new user entry with language preference
            const now = Date.now();
            const userData = {
                chatId,
                languagePreference: languageCode,
                firstSeenTimestamp: now,
                connectionTimestamp: 0,
                lastActivity: now,
                walletEverConnected: false
            };
            yield client.hSet('all_users', chatId.toString(), JSON.stringify(userData));
        }
        // Also store in dedicated language preferences hash for quicker lookups
        yield client.hSet('language_preferences', chatId.toString(), languageCode);
        if (DEBUG) {
            console.log(`[STORAGE] Set language preference for user ${chatId} to ${languageCode}`);
        }
    });
}
exports.setUserLanguage = setUserLanguage;
/**
 * Get a user's language preference
 */
function getUserLanguage(chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Try getting from dedicated language hash first (faster)
        const language = yield client.hGet('language_preferences', chatId.toString());
        if (language) {
            return language;
        }
        // If not found, check user data
        const existingUserData = yield client.hGet('all_users', chatId.toString());
        if (existingUserData) {
            const userData = JSON.parse(existingUserData);
            return userData.languagePreference || 'en'; // Default to English
        }
        return 'en'; // Default language is English
    });
}
exports.getUserLanguage = getUserLanguage;
function saveTransactionSubmission(chatId, transactionId) {
    return __awaiter(this, void 0, void 0, function* () {
        const submission = {
            id: transactionId,
            userId: chatId,
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
function getAllPendingTransactions() {
    return __awaiter(this, void 0, void 0, function* () {
        const transactions = yield client.hGetAll('transaction_submissions');
        return Object.values(transactions)
            .map(data => JSON.parse(data))
            .filter((submission) => submission.status === 'pending');
    });
}
exports.getAllPendingTransactions = getAllPendingTransactions;
/**
 * Save a test result
 */
function saveTestResult(chatId, result) {
    return __awaiter(this, void 0, void 0, function* () {
        // Generate a key for this test result
        const key = `test_result:${chatId}:${result.timestamp}`;
        yield client.set(key, JSON.stringify(result));
        // Add to the list of test results for this admin
        yield client.lPush(`test_results:${chatId}`, key);
        if (DEBUG) {
            console.log(`[STORAGE] Saved test result for ${result.testName} (${result.success ? 'Success' : 'Failure'})`);
        }
    });
}
exports.saveTestResult = saveTestResult;
/**
 * Get all test results for an admin
 */
function getTestResults(chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Get list of test result keys
        const resultKeys = yield client.lRange(`test_results:${chatId}`, 0, -1);
        if (!resultKeys || resultKeys.length === 0) {
            return [];
        }
        // Fetch each result
        const results = [];
        for (const key of resultKeys) {
            const data = yield client.get(key);
            if (data) {
                results.push(JSON.parse(data));
            }
        }
        // Sort by timestamp, newest first
        return results.sort((a, b) => b.timestamp - a.timestamp);
    });
}
exports.getTestResults = getTestResults;
/**
 * Clear all test results for an admin
 */
function clearTestResults(chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Get list of test result keys
        const resultKeys = yield client.lRange(`test_results:${chatId}`, 0, -1);
        if (resultKeys && resultKeys.length > 0) {
            // Delete each result
            for (const key of resultKeys) {
                yield client.del(key);
            }
        }
        // Clear the list itself
        yield client.del(`test_results:${chatId}`);
        if (DEBUG) {
            console.log(`[STORAGE] Cleared all test results for admin ${chatId}`);
        }
    });
}
exports.clearTestResults = clearTestResults;
/**
 * Save a support message from a user or admin response
 */
function saveSupportMessage(message) {
    return __awaiter(this, void 0, void 0, function* () {
        // Generate a unique key using userId and timestamp
        const key = `support:${message.userId}:${message.timestamp}`;
        yield client.set(key, JSON.stringify(message));
        yield client.hSet('support_messages', message.id, JSON.stringify(message));
        // Also add to a user-specific list for quick lookup
        yield client.sAdd(`support_messages:${message.userId}`, message.id);
        if (DEBUG) {
            console.log(`[STORAGE] Saved support message: ${message.id} from ${message.isAdminResponse ? 'admin' : 'user'} ${message.userId}`);
        }
    });
}
exports.saveSupportMessage = saveSupportMessage;
function getSupportMessagesForUser(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Get all message IDs for this user
        const messageIds = yield client.sMembers(`support_messages:${userId}`);
        if (!messageIds.length)
            return [];
        // Get all messages
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