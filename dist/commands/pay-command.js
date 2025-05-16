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
exports.RejectPaymentCommand = exports.ApprovePaymentCommand = exports.PendingPaymentsCommand = exports.PayNowCommand = void 0;
const base_command_1 = require("./base-command");
const bot_1 = require("../bot");
const redis_1 = require("redis");
const error_handler_1 = require("../error-handler");
// Redis client
const redisClient = (0, redis_1.createClient)({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        connectTimeout: 10000,
        keepAlive: 10000
    }
});
redisClient.on('error', err => console.error('Redis Client Error in Payment Command:', err));
// Connect to Redis if not already connected
function getRedisClient() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!redisClient.isOpen) {
            yield redisClient.connect();
        }
        return redisClient;
    });
}
// Redis keys for payment system
const PAYMENT_REQUEST_KEY = 'payment:request:';
const PENDING_PAYMENTS_KEY = 'payment:pending';
const APPROVED_PAYMENTS_KEY = 'payment:approved';
const REJECTED_PAYMENTS_KEY = 'payment:rejected';
/**
 * Command for submitting transactions for approval
 */
class PayNowCommand extends base_command_1.BaseCommand {
    constructor() {
        super('pay-now', false, 'Submit a transaction for approval');
    }
    executeCommand(msg) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            const userId = (_a = msg.from) === null || _a === void 0 ? void 0 : _a.id;
            const userName = ((_b = msg.from) === null || _b === void 0 ? void 0 : _b.username) || ((_c = msg.from) === null || _c === void 0 ? void 0 : _c.first_name) || 'Unknown User';
            if (!userId) {
                yield bot_1.bot.sendMessage(chatId, '❌ Error: Could not identify user.');
                return;
            }
            // Start the payment flow
            yield this.startPaymentSubmission(chatId, userId, userName);
        });
    }
    /**
     * Start the payment submission process
     */
    startPaymentSubmission(chatId, userId, userName) {
        return __awaiter(this, void 0, void 0, function* () {
            const instructions = `🔹 *Transaction Submission*\n\n` +
                `Please provide your transaction ID in the following format:\n\n` +
                `\`ABC123XYZ\`\n\n` +
                `This ID will be reviewed by our team for approval.`;
            // Send instructions with custom keyboard
            const msg = yield bot_1.bot.sendMessage(chatId, instructions, {
                parse_mode: 'Markdown',
                reply_markup: {
                    force_reply: true,
                    input_field_placeholder: 'Enter your transaction ID here',
                    resize_keyboard: true,
                    one_time_keyboard: true,
                }
            });
            // Register a one-time listener for the reply
            const messageId = msg.message_id;
            bot_1.bot.onReplyToMessage(chatId, messageId, (replyMsg) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                try {
                    const transactionId = (_a = replyMsg.text) === null || _a === void 0 ? void 0 : _a.trim();
                    if (!transactionId) {
                        yield bot_1.bot.sendMessage(chatId, '❌ Transaction ID cannot be empty. Please try again with /pay-now.');
                        return;
                    }
                    // Process the transaction ID
                    yield this.processTransactionSubmission(chatId, userId, userName, transactionId);
                }
                catch (error) {
                    error_handler_1.ErrorHandler.handleError({
                        type: error_handler_1.ErrorType.COMMAND_HANDLER,
                        message: `Error in pay-now reply handler: ${(error === null || error === void 0 ? void 0 : error.message) || error}`,
                        command: 'pay-now',
                        userId,
                        timestamp: Date.now(),
                        stack: error === null || error === void 0 ? void 0 : error.stack
                    });
                    yield bot_1.bot.sendMessage(chatId, '❌ An error occurred while processing your transaction. Please try again later.');
                }
            }));
        });
    }
    /**
     * Process the transaction submission
     */
    processTransactionSubmission(chatId, userId, userName, transactionId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Generate a unique payment request ID
            const requestId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            // Create payment request object
            const paymentRequest = {
                id: requestId,
                userId,
                chatId,
                transactionId,
                timestamp: Date.now(),
                status: 'pending',
                userName
            };
            // Store in Redis
            const redis = yield getRedisClient();
            yield redis.set(`${PAYMENT_REQUEST_KEY}${requestId}`, JSON.stringify(paymentRequest));
            yield redis.sAdd(PENDING_PAYMENTS_KEY, requestId);
            // Notify user
            yield bot_1.bot.sendMessage(chatId, `✅ Your transaction ID \`${transactionId}\` has been submitted for review.\n\n` +
                `Reference number: \`${requestId}\`\n\n` +
                `You will be notified once it has been processed by our team.`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🏠 Back to Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
            // Notify admins
            yield this.notifyAdminsNewPayment(paymentRequest);
        });
    }
    /**
     * Notify admins about a new payment request
     */
    notifyAdminsNewPayment(paymentRequest) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get admin IDs from environment variable
            const adminIdsEnv = process.env.ADMIN_IDS || '';
            const adminIds = adminIdsEnv.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            if (!adminIds.length) {
                console.warn('No admin IDs configured for payment notifications');
                return;
            }
            const notification = `🔔 *New Transaction Submission*\n\n` +
                `From: ${paymentRequest.userName || 'User'} (ID: ${paymentRequest.userId})\n` +
                `Transaction ID: \`${paymentRequest.transactionId}\`\n` +
                `Reference: \`${paymentRequest.id}\`\n` +
                `Time: ${new Date(paymentRequest.timestamp).toLocaleString()}\n\n` +
                `Use /approve ${paymentRequest.id} or /reject ${paymentRequest.id} to process.`;
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
exports.PayNowCommand = PayNowCommand;
/**
 * Command for admins to list pending payment requests
 */
class PendingPaymentsCommand extends base_command_1.BaseCommand {
    constructor() {
        super('pending', true, 'List pending payment requests (admin only)');
    }
    executeCommand(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            const redis = yield getRedisClient();
            // Get all pending payment requests
            const pendingIds = yield redis.sMembers(PENDING_PAYMENTS_KEY);
            if (!pendingIds.length) {
                yield bot_1.bot.sendMessage(chatId, '✅ No pending payment requests.');
                return;
            }
            let message = `🔸 *Pending Payment Requests (${pendingIds.length}):*\n\n`;
            for (const requestId of pendingIds) {
                const requestData = yield redis.get(`${PAYMENT_REQUEST_KEY}${requestId}`);
                if (requestData) {
                    try {
                        const request = JSON.parse(requestData);
                        const date = new Date(request.timestamp).toLocaleString();
                        const userName = request.userName || 'User';
                        message += `🆔 Ref: \`${request.id}\`\n`;
                        message += `👤 ${userName} (ID: ${request.userId})\n`;
                        message += `🧾 Transaction ID: \`${request.transactionId}\`\n`;
                        message += `🕒 ${date}\n`;
                        message += `✅ /approve ${request.id}\n`;
                        message += `❌ /reject ${request.id}\n\n`;
                    }
                    catch (e) {
                        message += `Error parsing request ${requestId}\n\n`;
                    }
                }
            }
            yield bot_1.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        });
    }
}
exports.PendingPaymentsCommand = PendingPaymentsCommand;
/**
 * Base class for approve/reject commands
 */
class PaymentActionCommand extends base_command_1.BaseCommand {
    constructor(commandName, description, action) {
        super(commandName, true, description);
        this.action = action;
    }
    executeCommand(msg) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            const adminId = (_a = msg.from) === null || _a === void 0 ? void 0 : _a.id;
            if (!adminId) {
                yield bot_1.bot.sendMessage(chatId, '❌ Error: Could not identify admin user.');
                return;
            }
            // Extract payment request ID
            const requestId = (_b = msg.text) === null || _b === void 0 ? void 0 : _b.substring(`/${this.name}`.length).trim();
            if (!requestId) {
                yield bot_1.bot.sendMessage(chatId, `❌ Please provide a payment reference ID: /${this.name} <reference_id>`);
                return;
            }
            yield this.processPaymentAction(chatId, adminId, requestId);
        });
    }
    /**
     * Process payment approval or rejection
     */
    processPaymentAction(chatId, _adminId, requestId) {
        return __awaiter(this, void 0, void 0, function* () {
            const redis = yield getRedisClient();
            // Get payment request data
            const requestData = yield redis.get(`${PAYMENT_REQUEST_KEY}${requestId}`);
            if (!requestData) {
                yield bot_1.bot.sendMessage(chatId, `❌ Payment request with ID ${requestId} not found.`);
                return;
            }
            try {
                // Parse payment request
                const request = JSON.parse(requestData);
                // Check if already processed
                if (request.status !== 'pending') {
                    yield bot_1.bot.sendMessage(chatId, `❌ This payment request has already been ${request.status}.`);
                    return;
                }
                // Update status
                request.status = this.action === 'approve' ? 'approved' : 'rejected';
                yield redis.set(`${PAYMENT_REQUEST_KEY}${requestId}`, JSON.stringify(request));
                // Move from pending to appropriate set
                yield redis.sRem(PENDING_PAYMENTS_KEY, requestId);
                yield redis.sAdd(this.action === 'approve' ? APPROVED_PAYMENTS_KEY : REJECTED_PAYMENTS_KEY, requestId);
                // Notify user
                yield this.notifyUser(request);
                // Confirm to admin
                yield bot_1.bot.sendMessage(chatId, `✅ Payment ${requestId} has been ${this.action}d successfully.`);
            }
            catch (error) {
                console.error(`Error processing payment ${this.action}:`, error);
                yield bot_1.bot.sendMessage(chatId, `❌ An error occurred while ${this.action}ing payment ${requestId}.`);
            }
        });
    }
    /**
     * Notify the user about their payment status
     */
    notifyUser(request) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!request.chatId)
                return;
            try {
                if (this.action === 'approve') {
                    yield bot_1.bot.sendMessage(request.chatId, `✅ *Transaction Approved*\n\n` +
                        `Your transaction with ID \`${request.transactionId}\` has been approved.\n` +
                        `Reference: \`${request.id}\`\n\n` +
                        `Thank you for using our service!`, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🏠 Back to Menu', callback_data: 'back_to_menu' }]
                            ]
                        }
                    });
                }
                else {
                    yield bot_1.bot.sendMessage(request.chatId, `❌ *Transaction Rejected*\n\n` +
                        `Your transaction with ID \`${request.transactionId}\` has been rejected.\n` +
                        `Reference: \`${request.id}\`\n\n` +
                        `Please contact support for more information using /support.`, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🏠 Back to Menu', callback_data: 'back_to_menu' }],
                                [{ text: '📞 Contact Support', callback_data: 'contact_support' }]
                            ]
                        }
                    });
                }
            }
            catch (error) {
                console.error(`Failed to notify user ${request.userId}:`, error);
            }
        });
    }
}
/**
 * Command for admins to approve payment requests
 */
class ApprovePaymentCommand extends PaymentActionCommand {
    constructor() {
        super('approve', 'Approve a payment request (admin only)', 'approve');
    }
}
exports.ApprovePaymentCommand = ApprovePaymentCommand;
/**
 * Command for admins to reject payment requests
 */
class RejectPaymentCommand extends PaymentActionCommand {
    constructor() {
        super('reject', 'Reject a payment request (admin only)', 'reject');
    }
}
exports.RejectPaymentCommand = RejectPaymentCommand;
//# sourceMappingURL=pay-command.js.map