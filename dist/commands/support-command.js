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
const error_handler_1 = require("../error-handler");
const storage_1 = require("../ton-connect/storage");
/**
 * Command to handle user support requests and admin responses
 */
class SupportCommand extends base_command_1.BaseCommand {
    constructor() {
        super('support', 'Send a message to support or respond to a user');
    }
    execute(msg, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            const isUserAdmin = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).includes(chatId);
            // No arguments provided
            if (!args || args.length === 0) {
                if (isUserAdmin) {
                    yield this.showSupportDashboard(chatId);
                    return;
                }
                else {
                    yield bot_1.bot.sendMessage(chatId, 'Please provide a message to send to support.\n\nExample: `/support I need help with...`', { parse_mode: 'Markdown' });
                    return;
                }
            }
            try {
                if (isUserAdmin) {
                    // Admin is responding to a user
                    yield this.handleAdminResponse(chatId, args);
                }
                else {
                    // User is sending a message to support
                    yield this.handleUserMessage(chatId, args);
                }
            }
            catch (error) {
                if (error instanceof Error) {
                    yield error_handler_1.ErrorHandler.handleError(error, error_handler_1.ErrorType.COMMAND_HANDLER, {
                        commandName: 'support',
                        userId: chatId,
                        message: msg.text || ''
                    });
                }
                yield bot_1.bot.sendMessage(chatId, '\u274c Error processing your support request. Please try again later.');
            }
        });
    }
    /**
     * Show support dashboard to admin
     */
    showSupportDashboard(adminId) {
        return __awaiter(this, void 0, void 0, function* () {
            const recentMessages = yield (0, storage_1.getSupportMessages)(10);
            if (recentMessages.length === 0) {
                yield bot_1.bot.sendMessage(adminId, '\ud83d\udcac *Support Dashboard* \ud83d\udcac\n\nThere are no recent support messages.');
                return;
            }
            let message = '\ud83d\udcac *Support Dashboard* \ud83d\udcac\n\n';
            message += '*Recent Support Messages:*\n\n';
            for (const msg of recentMessages) {
                const direction = msg.isResponse ? '\u2b07\ufe0f REPLY' : '\u2b06\ufe0f REQUEST';
                message += `${direction} | ${new Date(msg.timestamp).toLocaleString()}\n`;
                message += `From: ${msg.isResponse ? 'Admin' : `User ${msg.userId}`}\n`;
                message += `Message: ${msg.message}\n\n`;
                if (!msg.isResponse) {
                    message += `To reply: \`/support ${msg.userId} Your response here\`\n`;
                }
                message += '-------------------\n\n';
            }
            yield bot_1.bot.sendMessage(adminId, message, { parse_mode: 'Markdown' });
        });
    }
    /**
     * Handle admin response to a user
     */
    handleAdminResponse(adminId, args) {
        return __awaiter(this, void 0, void 0, function* () {
            // Format should be: /support USER_ID message
            const userId = parseInt(args[0] || '0');
            if (isNaN(userId)) {
                yield bot_1.bot.sendMessage(adminId, 'Invalid user ID. Please use the format: `/support USER_ID Your message here`', { parse_mode: 'Markdown' });
                return;
            }
            const responseMessage = args.slice(1).join(' ');
            if (!responseMessage) {
                yield bot_1.bot.sendMessage(adminId, 'Please provide a message to send to the user.', { parse_mode: 'Markdown' });
                return;
            }
            // Create and save response message
            const supportMessage = {
                id: `support_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                userId: userId,
                adminId: adminId,
                message: responseMessage,
                timestamp: Date.now(),
                isResponse: true
            };
            yield (0, storage_1.saveSupportMessage)(supportMessage);
            // Send message to user
            yield bot_1.bot.sendMessage(userId, `\ud83d\udcac *Support Response* \ud83d\udcac\n\n${responseMessage}\n\nReply with \`/support Your message\` to continue this conversation.`, { parse_mode: 'Markdown' });
            // Confirm to admin
            yield bot_1.bot.sendMessage(adminId, `\u2705 Your response has been sent to user ${userId}.`, { parse_mode: 'Markdown' });
        });
    }
    /**
     * Handle user support message
     */
    handleUserMessage(userId, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const userMessage = args.join(' ');
            // Create and save user message
            const supportMessage = {
                id: `support_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                userId: userId,
                message: userMessage,
                timestamp: Date.now(),
                isResponse: false
            };
            yield (0, storage_1.saveSupportMessage)(supportMessage);
            // Send confirmation to user
            yield bot_1.bot.sendMessage(userId, '\u2705 Your message has been sent to our support team. We will respond as soon as possible.', { parse_mode: 'Markdown' });
            // Notify all admins
            const adminIds = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim()));
            for (const adminId of adminIds) {
                if (adminId && !isNaN(adminId)) {
                    yield bot_1.bot.sendMessage(adminId, `\ud83d\udd14 *New Support Request* \ud83d\udd14\n\n` +
                        `From User: ${userId}\n` +
                        `Message: ${userMessage}\n\n` +
                        `To respond: \`/support ${userId} Your response here\``, { parse_mode: 'Markdown' });
                }
            }
        });
    }
}
exports.SupportCommand = SupportCommand;
//# sourceMappingURL=support-command.js.map