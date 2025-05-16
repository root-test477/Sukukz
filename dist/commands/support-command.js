"use strict";
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
exports.SupportCommand = void 0;
const base_command_1 = require("./base-command");
const bot_1 = require("../bot");
const utils_1 = require("../utils");
const redis_1 = require("redis");
// Redis client
const redisClient = (0, redis_1.createClient)({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        connectTimeout: 10000,
        keepAlive: 10000
    }
});
redisClient.on('error', err => console.error('Redis Client Error in Support Command:', err));
// Connect to Redis if not already connected
function getRedisClient() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!redisClient.isOpen) {
            yield redisClient.connect();
        }
        return redisClient;
    });
}
// Redis keys for support system
const SUPPORT_THREAD_KEY = 'support:thread:';
const SUPPORT_PENDING_KEY = 'support:pending';
/**
 * Command for handling user support requests
 */
class SupportCommand extends base_command_1.BaseCommand {
    constructor() {
        super('support', false, 'Contact support team or respond to support requests (admins only)');
    }
    executeCommand(msg, _match) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            const userId = (_a = msg.from) === null || _a === void 0 ? void 0 : _a.id;
            const userName = ((_b = msg.from) === null || _b === void 0 ? void 0 : _b.username) || ((_c = msg.from) === null || _c === void 0 ? void 0 : _c.first_name) || 'Unknown User';
            if (!userId) {
                yield bot_1.bot.sendMessage(chatId, '❌ Error: Could not identify user.');
                return;
            }
            // Extract message content (everything after /support)
            const messageContent = (_d = msg.text) === null || _d === void 0 ? void 0 : _d.substring('/support'.length).trim();
            if ((0, utils_1.isAdmin)(userId)) {
                // Admin using support command
                yield this.handleAdminSupport(chatId, userId, messageContent);
            }
            else {
                // Regular user using support command
                yield this.handleUserSupport(chatId, userId, userName, messageContent);
            }
        });
    }
    /**
     * Handle support requests from regular users
     */
    handleUserSupport(chatId, userId, userName, messageContent) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!messageContent) {
                yield bot_1.bot.sendMessage(chatId, '🔹 *Support System*\n\n' +
                    'To contact our support team, send your message using:\n' +
                    '`/support your message here`\n\n' +
                    'Our team will respond as soon as possible.', { parse_mode: 'Markdown' });
                return;
            }
            // Store the message in Redis
            const redis = yield getRedisClient();
            const threadKey = `${SUPPORT_THREAD_KEY}${userId}`;
            const message = {
                userId,
                messageText: messageContent,
                timestamp: Date.now(),
                userName
            };
            // Add to user's thread
            const messageJson = JSON.stringify(message);
            yield redis.rPush(threadKey, messageJson);
            // Set TTL for thread (30 days)
            yield redis.expire(threadKey, 30 * 24 * 60 * 60);
            // Add to pending list if not already there
            const isPending = yield redis.sIsMember(SUPPORT_PENDING_KEY, userId.toString());
            if (!isPending) {
                yield redis.sAdd(SUPPORT_PENDING_KEY, userId.toString());
            }
            // Notify all admins - ensure messageContent is definitely a string
            yield this.notifyAdmins(userId, userName, messageContent);
            // Confirm receipt to user
            yield bot_1.bot.sendMessage(chatId, '✅ Your message has been sent to our support team. We will respond as soon as possible.');
        });
    }
    /**
     * Handle admin responses to support requests
     */
    handleAdminSupport(chatId, adminId, messageContent) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!messageContent) {
                // Show list of pending support requests
                yield this.showPendingSupportRequests(chatId);
                return;
            }
            // Parse admin command format: /support <userId> <message>
            if (!messageContent) {
                yield bot_1.bot.sendMessage(chatId, '❌ Please provide a user ID and message. Format: /support <userId> <message>');
                return;
            }
            // At this point, messageContent is guaranteed to be a string because of our earlier null check
            // Use type assertion to inform TypeScript this is definitely a string
            const parts = messageContent.split(' ');
            // Ensure we have a valid string for parseInt to avoid TypeScript errors
            // Using a more explicit approach to handle the string for parseInt
            // Type assertion directly on the parts[0] element to force it to be string
            const firstPart = parts.length > 0 ? String(parts[0]) : '0';
            // Now we have a guaranteed string that can be passed to parseInt
            const targetUserId = parseInt(firstPart);
            if (isNaN(targetUserId)) {
                yield bot_1.bot.sendMessage(chatId, '❌ Invalid format. Use `/support <userId> <message>` to respond to a user.');
                return;
            }
            // Get the response message (everything after the user ID)
            let responseMessage = '';
            if (parts.length > 1) {
                responseMessage = parts.slice(1).join(' ').trim();
            }
            if (!responseMessage) {
                yield bot_1.bot.sendMessage(chatId, '❌ Please include a message to send to the user.');
                return;
            }
            // Store admin response in thread
            const redis = yield getRedisClient();
            const threadKey = `${SUPPORT_THREAD_KEY}${targetUserId}`;
            // Ensure we have valid strings for all fields to avoid TypeScript errors
            const message = {
                userId: adminId,
                messageText: responseMessage || '',
                timestamp: Date.now()
            };
            // Add to thread
            const messageJson = JSON.stringify(message);
            yield redis.rPush(threadKey, messageJson);
            // Send response to user
            try {
                yield bot_1.bot.sendMessage(targetUserId, `🔹 *Support Response:*\n\n${responseMessage}\n\nReply with \`/support your reply\` to continue this conversation.`, { parse_mode: 'Markdown' });
                // Confirm to admin
                yield bot_1.bot.sendMessage(chatId, `✅ Message sent to user ${targetUserId}.`);
            }
            catch (error) {
                console.error('Failed to send support response:', error);
                yield bot_1.bot.sendMessage(chatId, `❌ Failed to send message to user ${targetUserId}. They may have blocked the bot.`);
            }
        });
    }
    /**
     * Show list of pending support requests to admin
     */
    showPendingSupportRequests(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            const redis = yield getRedisClient();
            const pendingUserIds = yield redis.sMembers(SUPPORT_PENDING_KEY);
            if (!pendingUserIds.length) {
                yield bot_1.bot.sendMessage(chatId, '✅ No pending support requests.');
                return;
            }
            let message = '🔸 *Pending Support Requests:*\n\n';
            for (const userIdStr of pendingUserIds) {
                const userId = parseInt(userIdStr);
                const threadKey = `${SUPPORT_THREAD_KEY}${userId}`;
                // Get latest message from thread
                const threadLength = yield redis.lLen(threadKey);
                if (threadLength > 0) {
                    const latestMsg = yield redis.lIndex(threadKey, -1);
                    if (latestMsg && typeof latestMsg === 'string') {
                        try {
                            const msgObj = JSON.parse(latestMsg);
                            const date = new Date(msgObj.timestamp).toLocaleString();
                            const userName = msgObj.userName || 'User';
                            // Handle possibly undefined messageText
                            const messageText = msgObj.messageText || '';
                            const previewText = messageText.length > 50
                                ? messageText.substring(0, 50) + '...'
                                : messageText;
                            message += `👤 *${userName}* (ID: ${userId})\n`;
                            message += `📝 "${previewText}"\n`;
                            message += `🕒 ${date}\n`;
                            message += `Reply: \`/support ${userId} your response\`\n\n`;
                        }
                        catch (e) {
                            message += `👤 User ${userId}\n`;
                            message += `Error parsing message data\n\n`;
                        }
                    }
                }
                else {
                    message += `👤 User ${userId}\n`;
                    message += `No message content available\n\n`;
                }
            }
            message += 'To respond to a user, use:\n`/support <userId> <your message>`';
            yield bot_1.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        });
    }
    /**
     * Notify all admins about a new support request
     */
    notifyAdmins(userId, userName, messageContent) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get admin IDs from environment variable
            const adminIdsEnv = process.env.ADMIN_IDS || '';
            const adminIds = adminIdsEnv.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            if (!adminIds.length) {
                console.warn('No admin IDs configured for support notifications');
                return;
            }
            // Handle potentially undefined messageContent
            const safeMessageContent = messageContent || '(No message provided)';
            const notification = `🔔 *New Support Request*\n\n` +
                `From: ${userName} (ID: ${userId})\n` +
                `Message: ${safeMessageContent}\n\n` +
                `Reply with: \`/support ${userId} your response\``;
            for (const adminId of adminIds) {
                try {
                    yield bot_1.bot.sendMessage(adminId, notification, { parse_mode: 'Markdown' });
                }
                catch (error) {
                    console.error(`Failed to notify admin ${adminId}:`, error);
                }
            }
        });
    }
}
exports.SupportCommand = SupportCommand;
//# sourceMappingURL=support-command.js.map