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
exports.handleUsersCommand = exports.getAllUsers = exports.handleWithdrawCommand = exports.handleBackToMenuCallback = exports.handleRejectCommand = exports.handleApproveCommand = exports.handlePayNowCommand = exports.handleSupportCommand = exports.handleInfoCommand = exports.handleFundingCommand = void 0;
const sdk_1 = require("@tonconnect/sdk");
const wallets_1 = require("./ton-connect/wallets");
const bot_factory_1 = require("./bot-factory");
const storage_1 = require("./ton-connect/storage");
const utils_1 = require("./utils");
const connector_1 = require("./ton-connect/connector");
const utils_2 = require("./utils");
const error_boundary_1 = require("./error-boundary");
const commands_handlers_1 = require("./commands-handlers");
/**
 * Helper function to escape Markdown special characters in text
 * @param text Text to escape
 * @returns Escaped text safe for Markdown
 */
function escapeMarkdown(text) {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}
/**
 * Handler for the /funding command
 * Allows users to send a transaction with a custom amount
 */
function handleFundingCommand(msg, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        // Get the bot instance for this botId
        const botFactory = bot_factory_1.BotFactory.getInstance();
        const bot = botFactory.getBot(botId);
        if (!bot) {
            console.error(`Bot with ID ${botId} not found`);
            return;
        }
        // Extract amount from command if provided (e.g., /funding 200)
        const match = text.match(/\/funding\s+(\d+(\.\d+)?)/);
        const amount = match ? match[1] : null;
        if (!amount) {
            yield bot.sendMessage(chatId, 'Please specify an amount in TON. Example: /funding 200');
            return;
        }
        // Convert amount to nanoTON (1 TON = 10^9 nanoTON)
        const amountInNano = Math.floor(parseFloat(amount) * 1000000000).toString();
        const connector = (0, connector_1.getConnector)(chatId, botId);
        const connected = yield (0, commands_handlers_1.safeRestoreConnection)(connector, chatId, botId);
        if (!connected) {
            yield bot.sendMessage(chatId, 'Connect wallet to send transaction. If you\'re having connection issues, try /connect again.');
            return;
        }
        (0, utils_2.pTimeout)(connector.sendTransaction({
            validUntil: Math.round((Date.now() + Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS)) / 1000),
            messages: [
                {
                    amount: amountInNano,
                    address: process.env.DEFAULT_RECIPIENT_ADDRESS || '0:0000000000000000000000000000000000000000000000000000000000000000'
                }
            ]
        }), Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS))
            .then(() => __awaiter(this, void 0, void 0, function* () {
            // Update user activity with transaction amount
            yield (0, storage_1.updateUserActivity)(chatId, botId, amountInNano);
            yield bot.sendMessage(chatId, `Transaction of ${amount} TON sent successfully`);
        }))
            .catch((e) => __awaiter(this, void 0, void 0, function* () {
            if (e === utils_2.pTimeoutException) {
                yield bot.sendMessage(chatId, `Transaction was not confirmed`);
                return;
            }
            if (e instanceof sdk_1.UserRejectsError) {
                yield bot.sendMessage(chatId, `You rejected the transaction`);
                return;
            }
            yield bot.sendMessage(chatId, `Unknown error happened`);
        }))
            .finally(() => connector.pauseConnection());
        let deeplink = '';
        const walletInfo = yield (0, wallets_1.getWalletInfo)(connector.wallet.device.appName);
        if (walletInfo) {
            deeplink = walletInfo.universalLink;
        }
        if ((0, sdk_1.isTelegramUrl)(deeplink)) {
            const url = new URL(deeplink);
            url.searchParams.append('startattach', 'tonconnect');
            deeplink = (0, utils_2.addTGReturnStrategy)(url.toString(), process.env.TELEGRAM_BOT_LINK);
        }
        yield bot.sendMessage(chatId, `Open ${(walletInfo === null || walletInfo === void 0 ? void 0 : walletInfo.name) || connector.wallet.device.appName} and confirm transaction of ${amount} TON`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: `Open ${(walletInfo === null || walletInfo === void 0 ? void 0 : walletInfo.name) || connector.wallet.device.appName}`,
                            url: deeplink
                        }
                    ]
                ]
            }
        });
    });
}
exports.handleFundingCommand = handleFundingCommand;
/**
 * Handler for the /info command
 * Displays essential guidance and feature highlights
 */
function handleInfoCommand(msg, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Get the bot instance for this botId
        const botFactory = bot_factory_1.BotFactory.getInstance();
        const bot = botFactory.getBot(botId);
        if (!bot) {
            console.error(`Bot with ID ${botId} not found`);
            return;
        }
        const infoMessage = `<b>📱 Sukuk Financial Bot - Help & Recommendations 📱</b>

How to Connect a Wallet:
Use the /connect command and select a supported wallet.
🔹 Recommendation: Use @wallet as it is native to Telegram for seamless integration.

How to Get Support:
Use the /support command followed by your message to connect with a live support agent for real-time assistance.

How to Submit a Transaction for Approval:
After adding TON to your balance, use the /pay_now command followed by the transaction ID to submit it for admin confirmation and approval.

How to Withdraw:
To withdraw interests, securely use the website by using the /withdraw command or follow the Launch button on your screen.

Additional Commands:
/my_wallet - View your connected wallet details
/funding - Fund with a specific amount
/send_tx - Send a transaction with default amount
/withdraw - Access the withdrawal portal
/disconnect - Disconnect your wallet`;
        yield bot.sendMessage(chatId, infoMessage, { parse_mode: 'HTML' });
    });
}
exports.handleInfoCommand = handleInfoCommand;
/**
 * Handler for the /support command
 * Allows users to send support messages and admins to respond
 */
function handleSupportCommand(msg, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        // Get the bot instance for this botId
        const botFactory = bot_factory_1.BotFactory.getInstance();
        const bot = botFactory.getBot(botId);
        if (!bot) {
            console.error(`Bot with ID ${botId} not found`);
            return;
        }
        const userIsAdmin = (0, utils_1.isAdmin)(chatId, botId);
        // Check if this is an admin response to a user
        const adminResponseMatch = text.match(/\/support\s+(\d+)\s+(.+)/) || null;
        if (userIsAdmin && adminResponseMatch && adminResponseMatch[1] && adminResponseMatch[2]) {
            // Admin is responding to a user
            const targetUserId = parseInt(adminResponseMatch[1]);
            const responseMessage = adminResponseMatch[2].trim();
            if (!targetUserId || !responseMessage) {
                yield bot.sendMessage(chatId, 'Invalid format. Use: /support [user_id] [your response]');
                return;
            }
            // Save the admin's response
            const messageId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            yield (0, storage_1.saveSupportMessage)({
                id: messageId,
                userId: targetUserId,
                botId: botId,
                adminId: chatId,
                message: responseMessage,
                timestamp: Date.now(),
                isResponse: true
            });
            // Send the response to the user
            try {
                yield bot.sendMessage(targetUserId, `👤 *Support Response*\n\n${responseMessage}\n\nTo reply, use /support [your message]`, { parse_mode: 'Markdown' });
                yield bot.sendMessage(chatId, `Response sent to user ${targetUserId} successfully.`);
            }
            catch (error) {
                console.error('Error sending response to user:', error);
                yield bot.sendMessage(chatId, `Error sending response to user ${targetUserId}. They may have blocked the bot.`);
            }
            return;
        }
        // User sending a support message
        const messageMatch = text.match(/\/support\s+(.+)/) || null;
        if (!messageMatch) {
            // No message provided, show instructions
            yield bot.sendMessage(chatId, '💬 *Support System*\n\nTo send a message to our support team, use:\n/support [your message]\n\nExample: /support I need help with my transaction', { parse_mode: 'Markdown' });
            return;
        }
        if (!messageMatch[1]) {
            yield bot.sendMessage(chatId, 'Please provide a message. Example: /support I need help with my transaction');
            return;
        }
        const userMessage = messageMatch[1].trim();
        if (!userMessage) {
            yield bot.sendMessage(chatId, 'Please provide a message. Example: /support I need help with my transaction');
            return;
        }
        // Save the user's message
        const messageId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        yield (0, storage_1.saveSupportMessage)({
            id: messageId,
            userId: chatId,
            botId: botId,
            message: userMessage,
            timestamp: Date.now(),
            isResponse: false
        });
        // Notify the user that their message was received
        yield bot.sendMessage(chatId, '💬 *Message Received*\n\nThank you for your message. Our support team has been notified and will respond as soon as possible.', { parse_mode: 'Markdown' });
        // Notify all admins if enabled
        if (process.env.SUPPORT_NOTIFICATION_ENABLED === 'true') {
            // Get the bot-specific admin IDs
            const botConfig = botFactory.getBotConfig(botId);
            if (!botConfig || !botConfig.adminIds) {
                console.error(`No admin IDs configured for bot ${botId}`);
                return;
            }
            const adminIds = botConfig.adminIds;
            for (const adminId of adminIds) {
                try {
                    const userName = msg.from ? msg.from.first_name || 'Unknown' : 'Unknown';
                    const userNameWithId = `${userName} (ID: ${chatId})`;
                    yield bot.sendMessage(adminId, `📣 *New Support Message*\n\nFrom: ${userNameWithId}\n\nMessage: ${userMessage}\n\nTo respond, use:\n/support ${chatId} [your response]`, { parse_mode: 'Markdown' });
                }
                catch (error) {
                    console.error(`Failed to notify admin ${adminId}:`, error);
                }
            }
        }
    });
}
exports.handleSupportCommand = handleSupportCommand;
/**
 * Handler for the /pay_now command
 * Allows users to submit transaction IDs for admin approval
 * If user is admin, it shows pending transaction submissions
 */
function handlePayNowCommand(msg, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        // Get the bot instance for this botId
        const botFactory = bot_factory_1.BotFactory.getInstance();
        const bot = botFactory.getBot(botId);
        if (!bot) {
            console.error(`Bot with ID ${botId} not found`);
            return;
        }
        const userIsAdmin = (0, utils_1.isAdmin)(chatId, botId);
        // If admin with no arguments, show pending transactions
        if (userIsAdmin && text.trim() === '/pay_now') {
            const pendingTransactions = yield (0, storage_1.getAllPendingTransactions)();
            if (pendingTransactions.length === 0) {
                yield (0, error_boundary_1.safeSendMessage)(chatId, '📋 *No Pending Transactions*\n\nThere are currently no transactions waiting for approval.', { parse_mode: 'Markdown' });
                return;
            }
            // Format a list of pending transactions
            let message = '📋 *Pending Transactions*\n\n';
            pendingTransactions.forEach((tx, index) => {
                const date = new Date(tx.timestamp).toLocaleString();
                // Escape transaction ID to prevent Markdown parsing issues
                const safeTransactionId = escapeMarkdown(tx.id);
                message += `${index + 1}. Transaction ID: \`${safeTransactionId}\`\n`;
                message += `   User ID: ${tx.userId}\n`;
                message += `   Submitted: ${date}\n\n`;
            });
            message += 'To approve or reject a transaction, use:\n';
            message += '/approve [transaction_id]\n';
            message += '/reject [transaction_id]';
            yield (0, error_boundary_1.safeSendMessage)(chatId, message, { parse_mode: 'Markdown' });
            return;
        }
        // User submitting a new transaction
        const transactionMatch = text.match(/\/pay_now\s+(.+)/) || null;
        if (!transactionMatch) {
            // No transaction ID provided, show instructions
            yield (0, error_boundary_1.safeSendMessage)(chatId, '💸 *Transaction Submission*\n\nTo submit a transaction for approval, use:\n/pay_now [transaction_id]\n\nExample: /pay_now 97af4b72e0c98db5c1d8f5233...', {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                            { text: '« Back to Menu', callback_data: JSON.stringify({ method: 'back_to_menu', data: '' }) }
                        ]]
                }
            });
            return;
        }
        if (!transactionMatch[1]) {
            yield (0, error_boundary_1.safeSendMessage)(chatId, 'Please provide a transaction ID. Example: /pay_now 97af4b72e0c98db5c1d8f5233...');
            return;
        }
        const transactionId = transactionMatch[1].trim();
        if (!transactionId) {
            yield (0, error_boundary_1.safeSendMessage)(chatId, 'Please provide a valid transaction ID.');
            return;
        }
        // Check if this transaction ID has already been submitted
        const existingSubmission = yield (0, storage_1.getTransactionSubmission)(transactionId);
        if (existingSubmission) {
            let statusMessage = '';
            switch (existingSubmission.status) {
                case 'pending':
                    statusMessage = 'This transaction ID has already been submitted and is pending review.';
                    break;
                case 'approved':
                    statusMessage = 'This transaction ID has already been approved.';
                    break;
                case 'rejected':
                    statusMessage = 'This transaction ID was previously rejected. Please submit a new transaction or contact support.';
                    break;
            }
            yield (0, error_boundary_1.safeSendMessage)(chatId, `⚠️ *Transaction Already Exists*\n\n${statusMessage}`, { parse_mode: 'Markdown' });
            return;
        }
        // Save the new transaction submission
        yield (0, storage_1.saveTransactionSubmission)(chatId, botId, transactionId);
        // Notify the user that their submission was received
        yield (0, error_boundary_1.safeSendMessage)(chatId, '✅ *Transaction Submitted*\n\nYour transaction has been submitted for admin approval. You will be notified once it has been reviewed.', { parse_mode: 'Markdown' });
        // Notify all admins
        const botConfig = botFactory.getBotConfig(botId);
        if (!botConfig || !botConfig.adminIds) {
            console.error(`No admin IDs configured for bot ${botId}`);
            return;
        }
        const adminIds = botConfig.adminIds;
        for (const adminId of adminIds) {
            try {
                const userName = msg.from ? msg.from.first_name || 'Unknown' : 'Unknown';
                const userNameWithId = `${userName} (ID: ${chatId})`;
                // Escape transaction ID for markdown
                const safeTransactionId = escapeMarkdown(transactionId);
                yield (0, error_boundary_1.safeSendMessage)(adminId, `🔔 *New Transaction Submission*\n\nFrom: ${userNameWithId}\n\nTransaction ID: \`${safeTransactionId}\`\n\nTo approve or reject, use:\n/approve ${transactionId}\n/reject ${transactionId}`, { parse_mode: 'Markdown' });
            }
            catch (error) {
                console.error(`Failed to notify admin ${adminId}:`, error);
            }
        }
    });
}
exports.handlePayNowCommand = handlePayNowCommand;
/**
 * Handler for the /approve command (admin-only)
 * Approves a transaction submission
 */
function handleApproveCommand(msg, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        // Get the bot instance for this botId
        const botFactory = bot_factory_1.BotFactory.getInstance();
        const bot = botFactory.getBot(botId);
        if (!bot) {
            console.error(`Bot with ID ${botId} not found`);
            return;
        }
        // Check if user is admin
        if (!(0, utils_1.isAdmin)(chatId, botId)) {
            yield bot.sendMessage(chatId, '⛔ This command is for administrators only.');
            return;
        }
        // Extract transaction ID from command
        const match = text.match(/\/approve\s+([\w-]+)(?:\s+(.*))?/);
        if (!match || !match[1]) {
            yield bot.sendMessage(chatId, 'Please provide a transaction ID to approve. Example: /approve [transaction_id]');
            return;
        }
        const transactionId = match[1].trim();
        if (!transactionId) {
            yield bot.sendMessage(chatId, 'Please provide a valid transaction ID.');
            return;
        }
        // Attempt to update the transaction status
        const updatedTransaction = yield (0, storage_1.updateTransactionStatus)(transactionId, botId, 'approved', chatId);
        if (!updatedTransaction) {
            yield bot.sendMessage(chatId, '❌ Transaction not found. Please check the ID and try again.');
            return;
        }
        // Notify admin of successful approval
        yield bot.sendMessage(chatId, `✅ Transaction \`${transactionId}\` has been approved successfully.`, { parse_mode: 'Markdown' });
        // Notify user that their transaction was approved
        try {
            yield bot.sendMessage(updatedTransaction.userId, `✅ *Transaction Approved*\n\nYour transaction with ID \`${transactionId}\` has been approved successfully.`, { parse_mode: 'Markdown' });
        }
        catch (error) {
            console.error(`Failed to notify user ${updatedTransaction.userId}:`, error);
            yield bot.sendMessage(chatId, `Warning: Failed to notify user of approval. They may have blocked the bot.`);
        }
    });
}
exports.handleApproveCommand = handleApproveCommand;
/**
 * Handler for the /reject command (admin-only)
 * Rejects a transaction submission
 */
function handleRejectCommand(msg, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        // Get the bot instance for this botId
        const botFactory = bot_factory_1.BotFactory.getInstance();
        const bot = botFactory.getBot(botId);
        if (!bot) {
            console.error(`Bot with ID ${botId} not found`);
            return;
        }
        // Check if user is admin
        if (!(0, utils_1.isAdmin)(chatId, botId)) {
            yield bot.sendMessage(chatId, '⛔ This command is for administrators only.');
            return;
        }
        // Extract transaction ID from command
        const match = text.match(/\/reject\s+(.+)/) || null;
        if (!match || !match[1]) {
            yield bot.sendMessage(chatId, 'Please provide a transaction ID to reject. Example: /reject [transaction_id]');
            return;
        }
        const transactionId = match[1].trim();
        if (!transactionId) {
            yield bot.sendMessage(chatId, 'Please provide a valid transaction ID.');
            return;
        }
        // Attempt to update the transaction status
        const updatedTransaction = yield (0, storage_1.updateTransactionStatus)(transactionId, botId, 'rejected', chatId);
        if (!updatedTransaction) {
            yield bot.sendMessage(chatId, '❌ Transaction not found. Please check the ID and try again.');
            return;
        }
        // Notify admin of successful rejection
        yield bot.sendMessage(chatId, `❌ Transaction \`${transactionId}\` has been rejected.`, { parse_mode: 'Markdown' });
        // Notify user that their transaction was rejected
        try {
            yield bot.sendMessage(updatedTransaction.userId, `❌ *Transaction Rejected*\n\nYour transaction with ID \`${transactionId}\` was disapproved. Please verify the transaction ID and try again, or contact support using /support.`, { parse_mode: 'Markdown' });
        }
        catch (error) {
            console.error(`Failed to notify user ${updatedTransaction.userId}:`, error);
            yield bot.sendMessage(chatId, `Warning: Failed to notify user of rejection. They may have blocked the bot.`);
        }
    });
}
exports.handleRejectCommand = handleRejectCommand;
/**
 * Handler for the back_to_menu callback
 * Returns user to the main menu options
 */
function handleBackToMenuCallback(query, _data, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Get the bot instance for this botId
        const botFactory = bot_factory_1.BotFactory.getInstance();
        const bot = botFactory.getBot(botId);
        if (!bot) {
            console.error(`Bot with ID ${botId} not found`);
            return;
        }
        if (!query.message)
            return;
        const chatId = query.message.chat.id;
        try {
            yield bot.editMessageText('🔎 What would you like to do?', {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💼 Connect Wallet', callback_data: JSON.stringify({ method: 'connect_wallet', data: '' }) }],
                        [{ text: '💰 Send Transaction', callback_data: JSON.stringify({ method: 'send_transaction', data: '' }) }],
                        [{ text: '❓ Info & Help', callback_data: JSON.stringify({ method: 'show_info', data: '' }) }]
                    ]
                }
            });
        }
        catch (error) {
            console.error('Error displaying back to menu:', error);
            // If editing fails (e.g., message too old), send a new message instead
            try {
                yield (0, error_boundary_1.safeSendMessage)(chatId, '🔎 What would you like to do?', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '💼 Connect Wallet', callback_data: JSON.stringify({ method: 'connect_wallet', data: '' }) }],
                            [{ text: '💰 Send Transaction', callback_data: JSON.stringify({ method: 'send_transaction', data: '' }) }],
                            [{ text: '❓ Info & Help', callback_data: JSON.stringify({ method: 'show_info', data: '' }) }]
                        ]
                    }
                });
            }
            catch (sendError) {
                console.error('Failed to send fallback menu message:', sendError);
            }
        }
    });
}
exports.handleBackToMenuCallback = handleBackToMenuCallback;
/**
 * Handler for the /withdraw command
 * Loads a custom defined URL for withdrawals
 */
function handleWithdrawCommand(msg, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Get the bot instance for this botId
        const botFactory = bot_factory_1.BotFactory.getInstance();
        const bot = botFactory.getBot(botId);
        if (!bot) {
            console.error(`Bot with ID ${botId} not found`);
            return;
        }
        // Get the withdraw URL for this bot, fallback to default if not specified
        const botConfig = botFactory.getBotConfig(botId);
        const withdrawUrl = (botConfig === null || botConfig === void 0 ? void 0 : botConfig.withdrawUrl) || process.env.WITHDRAW_URL || 'https://dlb-sukuk.22web.org/withdraw';
        yield bot.sendMessage(chatId, '💰 *Withdraw Your Interest* 💰\n\nClick the button below to securely withdraw your earned interest through our website.', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{
                            text: '🔐 Secure Withdrawal Portal',
                            url: withdrawUrl
                        }]
                ]
            }
        });
    });
}
exports.handleWithdrawCommand = handleWithdrawCommand;
/**
 * Gets all users for a specific bot
 * @param botId The ID of the bot to get users for
 * @returns Array of user data
 */
function getAllUsers(botId) {
    return __awaiter(this, void 0, void 0, function* () {
        // This function should be implemented in the storage module
        // For now, return a subset of all tracked users filtered by botId
        const allUsers = yield (0, storage_1.getAllTrackedUsers)();
        return allUsers.filter(user => user.botId === botId);
    });
}
exports.getAllUsers = getAllUsers;
/**
 * Handler for the /users command (admin-only)
 * Shows all users who have interacted with the bot, including those who never connected a wallet
 */
function handleUsersCommand(msg, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Get the bot instance for this botId
        const botFactory = bot_factory_1.BotFactory.getInstance();
        const bot = botFactory.getBot(botId);
        if (!bot) {
            console.error(`Bot with ID ${botId} not found`);
            return;
        }
        // Track user interaction
        yield (0, storage_1.trackUserInteraction)(chatId, botId);
        // Check if the user is an admin
        if (!(0, utils_1.isAdmin)(chatId, botId)) {
            // Silently ignore for non-admins
            return;
        }
        // Placeholder for full implementation
        yield bot.sendMessage(chatId, '*Users information for multi-bot mode*\n\nThis feature is currently being updated to support multiple bots.', { parse_mode: 'Markdown' });
    });
}
exports.handleUsersCommand = handleUsersCommand;
//# sourceMappingURL=commands-handlers-missing.js.map