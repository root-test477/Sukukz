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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUsersCommand = exports.handleWithdrawCommand = exports.handleBackToMenuCallback = exports.handleRejectCommand = exports.handleApproveCommand = exports.handlePayNowCommand = exports.handleSupportCommand = exports.handleInfoCommand = exports.handleFundingCommand = exports.handleShowMyWalletCommand = exports.handleDisconnectCommand = exports.handleSendTXCommand = exports.handleConnectCommand = void 0;
const sdk_1 = require("@tonconnect/sdk");
const bot_1 = require("./bot");
const wallets_1 = require("./ton-connect/wallets");
const storage_1 = require("./ton-connect/storage");
const utils_1 = require("./utils");
const qrcode_1 = __importDefault(require("qrcode"));
const connector_1 = require("./ton-connect/connector");
const utils_2 = require("./utils");
let newConnectRequestListenersMap = new Map();
function handleConnectCommand(msg) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        let messageWasDeleted = false;
        (_a = newConnectRequestListenersMap.get(chatId)) === null || _a === void 0 ? void 0 : _a();
        const connector = (0, connector_1.getConnector)(chatId, () => {
            unsubscribe();
            newConnectRequestListenersMap.delete(chatId);
            deleteMessage();
        });
        yield connector.restoreConnection();
        if (connector.connected) {
            const connectedName = ((_b = (yield (0, wallets_1.getWalletInfo)(connector.wallet.device.appName))) === null || _b === void 0 ? void 0 : _b.name) ||
                connector.wallet.device.appName;
            yield bot_1.bot.sendMessage(chatId, `You have already connect ${connectedName} wallet\nYour address: ${(0, sdk_1.toUserFriendlyAddress)(connector.wallet.account.address, connector.wallet.account.chain === sdk_1.CHAIN.TESTNET)}\n\n Disconnect wallet firstly to connect a new one`);
            return;
        }
        const unsubscribe = connector.onStatusChange((wallet) => __awaiter(this, void 0, void 0, function* () {
            var _c;
            if (wallet) {
                yield deleteMessage();
                const walletName = ((_c = (yield (0, wallets_1.getWalletInfo)(wallet.device.appName))) === null || _c === void 0 ? void 0 : _c.name) || wallet.device.appName;
                // Save the connected user to storage
                yield (0, storage_1.saveConnectedUser)(chatId, wallet.account.address);
                yield bot_1.bot.sendMessage(chatId, `${walletName} wallet connected successfully`);
                unsubscribe();
                newConnectRequestListenersMap.delete(chatId);
            }
        }));
        const wallets = yield (0, wallets_1.getWallets)();
        const link = connector.connect(wallets);
        const image = yield qrcode_1.default.toBuffer(link);
        const keyboard = yield (0, utils_2.buildUniversalKeyboard)(link, wallets);
        const botMessage = yield bot_1.bot.sendPhoto(chatId, image, {
            reply_markup: {
                inline_keyboard: [keyboard]
            }
        });
        const deleteMessage = () => __awaiter(this, void 0, void 0, function* () {
            if (!messageWasDeleted) {
                messageWasDeleted = true;
                yield bot_1.bot.deleteMessage(chatId, botMessage.message_id);
            }
        });
        newConnectRequestListenersMap.set(chatId, () => __awaiter(this, void 0, void 0, function* () {
            unsubscribe();
            yield deleteMessage();
            newConnectRequestListenersMap.delete(chatId);
        }));
    });
}
exports.handleConnectCommand = handleConnectCommand;
function handleSendTXCommand(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const connector = (0, connector_1.getConnector)(chatId);
        const connected = yield safeRestoreConnection(connector, chatId);
        if (!connected) {
            yield bot_1.bot.sendMessage(chatId, 'Connect wallet to send transaction. If you\'re having connection issues, try /connect again.');
            return;
        }
        (0, utils_2.pTimeout)(connector.sendTransaction({
            validUntil: Math.round((Date.now() + Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS)) / 1000),
            messages: [
                {
                    amount: process.env.DEFAULT_TRANSACTION_AMOUNT || '100000000',
                    address: process.env.DEFAULT_RECIPIENT_ADDRESS || '0:0000000000000000000000000000000000000000000000000000000000000000'
                }
            ]
        }), Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS))
            .then(() => __awaiter(this, void 0, void 0, function* () {
            // Update user activity with transaction amount
            const amount = process.env.DEFAULT_TRANSACTION_AMOUNT || '100000000';
            yield (0, storage_1.updateUserActivity)(chatId, amount);
            bot_1.bot.sendMessage(chatId, `Transaction sent successfully`);
        }))
            .catch(e => {
            if (e === utils_2.pTimeoutException) {
                bot_1.bot.sendMessage(chatId, `Transaction was not confirmed`);
                return;
            }
            if (e instanceof sdk_1.UserRejectsError) {
                bot_1.bot.sendMessage(chatId, `You rejected the transaction`);
                return;
            }
            bot_1.bot.sendMessage(chatId, `Unknown error happened`);
        })
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
        yield bot_1.bot.sendMessage(chatId, `Open ${(walletInfo === null || walletInfo === void 0 ? void 0 : walletInfo.name) || connector.wallet.device.appName} and confirm transaction`, {
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
exports.handleSendTXCommand = handleSendTXCommand;
function handleDisconnectCommand(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const connector = (0, connector_1.getConnector)(chatId);
        yield connector.restoreConnection();
        if (!connector.connected) {
            yield bot_1.bot.sendMessage(chatId, "You didn't connect a wallet");
            return;
        }
        yield connector.disconnect();
        // Remove user from tracking when they disconnect
        yield (0, storage_1.removeConnectedUser)(chatId);
        yield bot_1.bot.sendMessage(chatId, 'Wallet has been disconnected');
    });
}
exports.handleDisconnectCommand = handleDisconnectCommand;
/**
 * Attempt to safely restore a wallet connection with retries
 * @param connector - The connector to restore
 * @param chatId - The chat ID for logging
 * @returns true if connection was successful, false otherwise
 */
function safeRestoreConnection(connector, chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Make multiple attempts to restore the connection
            for (let attempt = 1; attempt <= 3; attempt++) {
                console.log(`[WALLET] Attempt ${attempt} to restore connection for chat ${chatId}`);
                try {
                    yield connector.restoreConnection();
                    if (connector.connected) {
                        console.log(`[WALLET] Successfully connected on attempt ${attempt} for chat ${chatId}`);
                        return true;
                    }
                }
                catch (error) {
                    console.log(`[WALLET] Error on attempt ${attempt}:`, error);
                    // Wait before retry
                    yield new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                }
            }
            console.log(`[WALLET] All connection attempts failed for chat ${chatId}`);
            return false;
        }
        catch (error) {
            console.log(`[WALLET] Unexpected error during connection attempts:`, error);
            return false;
        }
    });
}
function handleShowMyWalletCommand(msg) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const connector = (0, connector_1.getConnector)(chatId);
        // Use our enhanced connection method
        const connected = yield safeRestoreConnection(connector, chatId);
        if (!connected) {
            yield bot_1.bot.sendMessage(chatId, "You didn't connect a wallet or connection failed. Try using /connect again");
            return;
        }
        const walletName = ((_a = (yield (0, wallets_1.getWalletInfo)(connector.wallet.device.appName))) === null || _a === void 0 ? void 0 : _a.name) ||
            connector.wallet.device.appName;
        yield bot_1.bot.sendMessage(chatId, `Connected wallet: ${walletName}\nYour address: ${(0, sdk_1.toUserFriendlyAddress)(connector.wallet.account.address, connector.wallet.account.chain === sdk_1.CHAIN.TESTNET)}`);
    });
}
exports.handleShowMyWalletCommand = handleShowMyWalletCommand;
/**
 * Handler for the /funding command
 * Allows users to send a transaction with a custom amount
 */
function handleFundingCommand(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        // Extract amount from command if provided (e.g., /funding 200)
        const match = text.match(/\/funding\s+(\d+(\.\d+)?)/);
        const amount = match ? match[1] : null;
        if (!amount) {
            yield bot_1.bot.sendMessage(chatId, 'Please specify an amount in TON. Example: /funding 200');
            return;
        }
        // Convert amount to nanoTON (1 TON = 10^9 nanoTON)
        const amountInNano = Math.floor(parseFloat(amount) * 1000000000).toString();
        const connector = (0, connector_1.getConnector)(chatId);
        const connected = yield safeRestoreConnection(connector, chatId);
        if (!connected) {
            yield bot_1.bot.sendMessage(chatId, 'Connect wallet to send transaction. If you\'re having connection issues, try /connect again.');
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
            yield (0, storage_1.updateUserActivity)(chatId, amountInNano);
            bot_1.bot.sendMessage(chatId, `Transaction of ${amount} TON sent successfully`);
        }))
            .catch(e => {
            if (e === utils_2.pTimeoutException) {
                bot_1.bot.sendMessage(chatId, `Transaction was not confirmed`);
                return;
            }
            if (e instanceof sdk_1.UserRejectsError) {
                bot_1.bot.sendMessage(chatId, `You rejected the transaction`);
                return;
            }
            bot_1.bot.sendMessage(chatId, `Unknown error happened`);
        })
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
        yield bot_1.bot.sendMessage(chatId, `Open ${(walletInfo === null || walletInfo === void 0 ? void 0 : walletInfo.name) || connector.wallet.device.appName} and confirm transaction of ${amount} TON`, {
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
function handleInfoCommand(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const infoMessage = `
📱 *Sukuk Financial Bot - Help & Recommendations* 📱

`
            + `*How to Connect a Wallet*:
`
            + `Use the \/connect command and select a supported wallet.
`
            + `🔹 *Recommendation*: Use @wallet as it is native to Telegram for seamless integration.

`
            + `*How to Get Support*:
`
            + `Use the \/support command followed by your message to connect with a live support agent for real-time assistance.

`
            + `*How to Submit a Transaction for Approval*:
`
            + `After adding TON to your balance, use the \/pay-now command followed by your transaction ID to send it for admin confirmation and approval.

`
            + `*How to Withdraw*:
`
            + `To withdraw interests, securely use the website by using the \/withdraw command or follow the launch button on your screen.

`
            + `*Additional Commands*:
`
            + `\/connect - Connect your TON wallet
`
            + `\/my_wallet - View your connected wallet details
`
            + `\/funding [amount] - Fund with a specific amount
`
            + `\/send_tx - Send a transaction with default amount
`
            + `\/disconnect - Disconnect your wallet
`;
        yield bot_1.bot.sendMessage(chatId, infoMessage, { parse_mode: 'Markdown' });
    });
}
exports.handleInfoCommand = handleInfoCommand;
/**
 * Handler for the /support command
 * Allows users to send support messages and admins to respond
 */
function handleSupportCommand(msg) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        const userIsAdmin = (0, utils_1.isAdmin)(chatId);
        // Check if this is an admin response to a user
        const adminResponseMatch = text.match(/\/support\s+(\d+)\s+(.+)/) || null;
        if (userIsAdmin && adminResponseMatch && adminResponseMatch[1] && adminResponseMatch[2]) {
            // Admin is responding to a user
            const targetUserId = parseInt(adminResponseMatch[1]);
            const responseMessage = adminResponseMatch[2].trim();
            if (!targetUserId || !responseMessage) {
                yield bot_1.bot.sendMessage(chatId, 'Invalid format. Use: /support [user_id] [your response]');
                return;
            }
            // Type assertion for TypeScript
            if (!adminResponseMatch[1] || !adminResponseMatch[2]) {
                yield bot_1.bot.sendMessage(chatId, 'Invalid format. Use: /support [user_id] [your response]');
                return;
            }
            // Save the admin's response
            const messageId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            yield (0, storage_1.saveSupportMessage)({
                id: messageId,
                userId: targetUserId,
                adminId: chatId,
                message: responseMessage,
                timestamp: Date.now(),
                isResponse: true
            });
            // Send the response to the user
            try {
                yield bot_1.bot.sendMessage(targetUserId, `👤 *Support Response*\n\n${responseMessage}\n\nTo reply, use /support [your message]`, { parse_mode: 'Markdown' });
                yield bot_1.bot.sendMessage(chatId, `Response sent to user ${targetUserId} successfully.`);
            }
            catch (error) {
                console.error('Error sending response to user:', error);
                yield bot_1.bot.sendMessage(chatId, `Error sending response to user ${targetUserId}. They may have blocked the bot.`);
            }
            return;
        }
        // User sending a support message
        const messageMatch = text.match(/\/support\s+(.+)/) || null;
        if (!messageMatch) {
            // No message provided, show instructions
            yield bot_1.bot.sendMessage(chatId, '💬 *Support System*\n\nTo send a message to our support team, use:\n/support [your message]\n\nExample: /support I need help with my transaction', { parse_mode: 'Markdown' });
            return;
        }
        // Type assertion for TypeScript
        if (!messageMatch[1]) {
            yield bot_1.bot.sendMessage(chatId, 'Please provide a message. Example: /support I need help with my transaction');
            return;
        }
        const userMessage = messageMatch[1].trim();
        if (!userMessage) {
            yield bot_1.bot.sendMessage(chatId, 'Please provide a message. Example: /support I need help with my transaction');
            return;
        }
        // Save the user's message
        const messageId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        yield (0, storage_1.saveSupportMessage)({
            id: messageId,
            userId: chatId,
            message: userMessage,
            timestamp: Date.now(),
            isResponse: false
        });
        // Notify the user that their message was received
        yield bot_1.bot.sendMessage(chatId, '💬 *Message Received*\n\nThank you for your message. Our support team has been notified and will respond as soon as possible.', { parse_mode: 'Markdown' });
        // Notify all admins if enabled
        if (process.env.SUPPORT_NOTIFICATION_ENABLED === 'true') {
            const adminIds = ((_a = process.env.ADMIN_IDS) === null || _a === void 0 ? void 0 : _a.split(',').map(id => Number(id.trim()))) || [];
            for (const adminId of adminIds) {
                try {
                    const userName = msg.from ? msg.from.first_name || 'Unknown' : 'Unknown';
                    const userNameWithId = `${userName} (ID: ${chatId})`;
                    yield bot_1.bot.sendMessage(adminId, `📣 *New Support Message*\n\nFrom: ${userNameWithId}\n\nMessage: ${userMessage}\n\nTo respond, use:\n/support ${chatId} [your response]`, { parse_mode: 'Markdown' });
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
 * Handler for the /pay-now command
 * Allows users to submit transaction IDs for admin approval
 * If user is admin, it shows pending transaction submissions
 */
function handlePayNowCommand(msg) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        const userIsAdmin = (0, utils_1.isAdmin)(chatId);
        // If admin with no arguments, show pending transactions
        if (userIsAdmin && text.trim() === '/pay-now') {
            const pendingTransactions = yield (0, storage_1.getAllPendingTransactions)();
            if (pendingTransactions.length === 0) {
                yield bot_1.bot.sendMessage(chatId, '📋 *No Pending Transactions*\n\nThere are currently no transactions waiting for approval.', { parse_mode: 'Markdown' });
                return;
            }
            // Format a list of pending transactions
            let message = '📋 *Pending Transactions*\n\n';
            pendingTransactions.forEach((tx, index) => {
                const date = new Date(tx.timestamp).toLocaleString();
                message += `${index + 1}. Transaction ID: \`${tx.id}\`\n`;
                message += `   User ID: ${tx.userId}\n`;
                message += `   Submitted: ${date}\n\n`;
            });
            message += 'To approve or reject a transaction, use:\n';
            message += '/approve [transaction_id]\n';
            message += '/reject [transaction_id]';
            yield bot_1.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            return;
        }
        // User submitting a new transaction
        const transactionMatch = text.match(/\/pay-now\s+(.+)/) || null;
        if (!transactionMatch) {
            // No transaction ID provided, show instructions
            yield bot_1.bot.sendMessage(chatId, '💸 *Transaction Submission*\n\nTo submit a transaction for approval, use:\n/pay-now [transaction_id]\n\nExample: /pay-now 97af4b72e0c98db5c1d8f5233...', {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                            { text: '« Back to Menu', callback_data: 'back_to_menu' }
                        ]]
                }
            });
            return;
        }
        // Type assertion for TypeScript
        if (!transactionMatch[1]) {
            yield bot_1.bot.sendMessage(chatId, 'Please provide a transaction ID. Example: /pay-now 97af4b72e0c98db5c1d8f5233...');
            return;
        }
        const transactionId = transactionMatch[1].trim();
        if (!transactionId) {
            yield bot_1.bot.sendMessage(chatId, 'Please provide a valid transaction ID.');
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
            yield bot_1.bot.sendMessage(chatId, `⚠️ *Transaction Already Exists*\n\n${statusMessage}`, { parse_mode: 'Markdown' });
            return;
        }
        // Save the new transaction submission
        yield (0, storage_1.saveTransactionSubmission)(chatId, transactionId);
        // Notify the user that their submission was received
        yield bot_1.bot.sendMessage(chatId, '✅ *Transaction Submitted*\n\nYour transaction has been submitted for admin approval. You will be notified once it has been reviewed.', { parse_mode: 'Markdown' });
        // Notify all admins
        const adminIds = ((_a = process.env.ADMIN_IDS) === null || _a === void 0 ? void 0 : _a.split(',').map(id => Number(id.trim()))) || [];
        for (const adminId of adminIds) {
            try {
                const userName = msg.from ? msg.from.first_name || 'Unknown' : 'Unknown';
                const userNameWithId = `${userName} (ID: ${chatId})`;
                yield bot_1.bot.sendMessage(adminId, `🔔 *New Transaction Submission*\n\nFrom: ${userNameWithId}\n\nTransaction ID: \`${transactionId}\`\n\nTo approve or reject, use:\n/approve ${transactionId}\n/reject ${transactionId}`, { parse_mode: 'Markdown' });
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
function handleApproveCommand(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        // Check if user is admin
        if (!(0, utils_1.isAdmin)(chatId)) {
            yield bot_1.bot.sendMessage(chatId, '⛔ This command is for administrators only.');
            return;
        }
        // Extract transaction ID from command
        const match = text.match(/\/approve\s+(.+)/) || null;
        if (!match || !match[1]) {
            yield bot_1.bot.sendMessage(chatId, 'Please provide a transaction ID to approve. Example: /approve [transaction_id]');
            return;
        }
        const transactionId = match[1].trim();
        if (!transactionId) {
            yield bot_1.bot.sendMessage(chatId, 'Please provide a valid transaction ID.');
            return;
        }
        // Attempt to update the transaction status
        const updatedTransaction = yield (0, storage_1.updateTransactionStatus)(transactionId, 'approved', chatId);
        if (!updatedTransaction) {
            yield bot_1.bot.sendMessage(chatId, '❌ Transaction not found. Please check the ID and try again.');
            return;
        }
        // Notify admin of successful approval
        yield bot_1.bot.sendMessage(chatId, `✅ Transaction \`${transactionId}\` has been approved successfully.`, { parse_mode: 'Markdown' });
        // Notify user that their transaction was approved
        try {
            yield bot_1.bot.sendMessage(updatedTransaction.userId, `✅ *Transaction Approved*\n\nYour transaction with ID \`${transactionId}\` has been approved successfully.`, { parse_mode: 'Markdown' });
        }
        catch (error) {
            console.error(`Failed to notify user ${updatedTransaction.userId}:`, error);
            yield bot_1.bot.sendMessage(chatId, `Warning: Failed to notify user of approval. They may have blocked the bot.`);
        }
    });
}
exports.handleApproveCommand = handleApproveCommand;
/**
 * Handler for the /reject command (admin-only)
 * Rejects a transaction submission
 */
function handleRejectCommand(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        // Check if user is admin
        if (!(0, utils_1.isAdmin)(chatId)) {
            yield bot_1.bot.sendMessage(chatId, '⛔ This command is for administrators only.');
            return;
        }
        // Extract transaction ID from command
        const match = text.match(/\/reject\s+(.+)/) || null;
        if (!match || !match[1]) {
            yield bot_1.bot.sendMessage(chatId, 'Please provide a transaction ID to reject. Example: /reject [transaction_id]');
            return;
        }
        const transactionId = match[1].trim();
        if (!transactionId) {
            yield bot_1.bot.sendMessage(chatId, 'Please provide a valid transaction ID.');
            return;
        }
        // Attempt to update the transaction status
        const updatedTransaction = yield (0, storage_1.updateTransactionStatus)(transactionId, 'rejected', chatId);
        if (!updatedTransaction) {
            yield bot_1.bot.sendMessage(chatId, '❌ Transaction not found. Please check the ID and try again.');
            return;
        }
        // Notify admin of successful rejection
        yield bot_1.bot.sendMessage(chatId, `❌ Transaction \`${transactionId}\` has been rejected.`, { parse_mode: 'Markdown' });
        // Notify user that their transaction was rejected
        try {
            yield bot_1.bot.sendMessage(updatedTransaction.userId, `❌ *Transaction Rejected*\n\nYour transaction with ID \`${transactionId}\` was disapproved. Please verify the transaction ID and try again, or contact support using /support.`, { parse_mode: 'Markdown' });
        }
        catch (error) {
            console.error(`Failed to notify user ${updatedTransaction.userId}:`, error);
            yield bot_1.bot.sendMessage(chatId, `Warning: Failed to notify user of rejection. They may have blocked the bot.`);
        }
    });
}
exports.handleRejectCommand = handleRejectCommand;
/**
 * Handler for the back_to_menu callback
 * Returns user to the main menu options
 */
function handleBackToMenuCallback(query) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!query.message)
            return;
        const chatId = query.message.chat.id;
        yield bot_1.bot.editMessageText('🔍 What would you like to do?', {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💼 Connect Wallet', callback_data: 'connect_wallet' }],
                    [{ text: '💰 Send Transaction', callback_data: 'send_transaction' }],
                    [{ text: '❓ Info & Help', callback_data: 'show_info' }]
                ]
            }
        });
    });
}
exports.handleBackToMenuCallback = handleBackToMenuCallback;
/**
 * Handler for the /withdraw command
 * Loads a custom defined URL for withdrawals
 */
function handleWithdrawCommand(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const withdrawUrl = process.env.WITHDRAW_URL || 'https://dlb-sukuk.22web.org/withdraw';
        yield bot_1.bot.sendMessage(chatId, '💰 *Withdraw Your Interest* 💰\n\nClick the button below to securely withdraw your earned interest through our website.', {
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
 * Handler for the /users command (admin-only)
 * Shows all users who have interacted with the bot, including those who never connected a wallet
 */
function handleUsersCommand(msg) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Track this admin's interaction
        yield (0, storage_1.trackUserInteraction)(chatId);
        // Check if the user is an admin
        if (!(0, utils_1.isAdmin)(chatId)) {
            // Silently ignore for non-admins
            return;
        }
        try {
            // Get ALL tracked users from storage (not just connected ones)
            const allUsers = yield (0, storage_1.getAllTrackedUsers)();
            if (allUsers.length === 0) {
                yield bot_1.bot.sendMessage(chatId, 'No users have interacted with the bot yet.');
                return;
            }
            // Sort users: connected users first, then by last activity time
            allUsers.sort((a, b) => {
                // Connected users first
                if (a.walletEverConnected && !b.walletEverConnected)
                    return -1;
                if (!a.walletEverConnected && b.walletEverConnected)
                    return 1;
                // Then by last activity (most recent first)
                return b.lastActivity - a.lastActivity;
            });
            let messageText = '🔍 *Users Overview*\n\n';
            let connectedCount = 0;
            let totalUsers = allUsers.length;
            // Count connected users for summary
            connectedCount = allUsers.filter(user => user.walletEverConnected).length;
            messageText += `📊 *Summary:* ${totalUsers} total users, ${connectedCount} have connected wallets\n\n`;
            for (const user of allUsers) {
                // Get current wallet status for connected users
                let currentWalletInfo = null;
                if (user.walletEverConnected && user.walletAddress) {
                    const connector = (0, connector_1.getConnector)(user.chatId);
                    try {
                        yield connector.restoreConnection();
                        if (connector.connected && connector.wallet) {
                            currentWalletInfo = {
                                address: (0, sdk_1.toUserFriendlyAddress)(connector.wallet.account.address, connector.wallet.account.chain === sdk_1.CHAIN.TESTNET),
                                name: ((_a = (yield (0, wallets_1.getWalletInfo)(connector.wallet.device.appName))) === null || _a === void 0 ? void 0 : _a.name) ||
                                    connector.wallet.device.appName
                            };
                        }
                    }
                    catch (err) {
                        console.error(`Error restoring connection for user ${user.chatId}:`, err);
                    }
                }
                // Format user information
                messageText += `👤 *User ID:* ${user.chatId}\n`;
                // Show wallet status
                if (!user.walletEverConnected) {
                    messageText += `❌ *Wallet:* Never connected\n`;
                }
                else if (currentWalletInfo) {
                    messageText += `📱 *Wallet:* ${currentWalletInfo.name}\n`;
                    messageText += `📝 *Address:* \`${currentWalletInfo.address}\`\n`;
                }
                else {
                    messageText += `⚠️ *Wallet:* Previously connected but now disconnected\n`;
                    if (user.walletAddress) {
                        messageText += `📝 *Last Address:* \`${user.walletAddress}\`\n`;
                    }
                }
                // Show transaction info if available
                if (user.lastTransactionAmount) {
                    const amountInTON = (Number(user.lastTransactionAmount) / 1000000000).toFixed(2);
                    messageText += `💸 *Last Transaction:* ${amountInTON} TON\n`;
                }
                // Show timestamps
                const firstSeen = new Date(user.firstSeenTimestamp).toLocaleString();
                messageText += `🕒 *First seen:* ${firstSeen}\n`;
                if (user.walletEverConnected) {
                    const connectedTime = new Date(user.connectionTimestamp).toLocaleString();
                    messageText += `🔗 *Last connected:* ${connectedTime}\n`;
                }
                const lastActive = new Date(user.lastActivity).toLocaleString();
                messageText += `⏱️ *Last active:* ${lastActive}\n`;
                messageText += `\n-------------------\n`;
            }
            // Send the message with markdown formatting (may need to split for large user counts)
            const maxMessageLength = 4000; // Telegram message limit is 4096, leave some margin
            if (messageText.length <= maxMessageLength) {
                yield bot_1.bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown' });
            }
            else {
                // Split into multiple messages if too long
                let messageParts = [];
                let currentPart = messageText.substring(0, messageText.indexOf('\n-------------------\n') + 21); // Include header in first part
                let remainingText = messageText.substring(currentPart.length);
                messageParts.push(currentPart);
                // Split the rest by user entries (using the separator)
                const separator = '\n-------------------\n';
                const userEntries = remainingText.split(separator);
                currentPart = '';
                for (const entry of userEntries) {
                    if (entry.trim() === '')
                        continue;
                    if ((currentPart + entry + separator).length > maxMessageLength) {
                        if (currentPart !== '') {
                            messageParts.push(currentPart);
                        }
                        currentPart = entry + separator;
                    }
                    else {
                        currentPart += entry + separator;
                    }
                }
                if (currentPart !== '') {
                    messageParts.push(currentPart);
                }
                // Send each part
                for (let i = 0; i < messageParts.length; i++) {
                    yield bot_1.bot.sendMessage(chatId, messageParts[i] + (i < messageParts.length - 1 ? '\n*Continued in next message...*' : ''), { parse_mode: 'Markdown' });
                }
            }
        }
        catch (error) {
            console.error('Error in handleUsersCommand:', error);
            yield bot_1.bot.sendMessage(chatId, 'Error fetching users information.');
        }
    });
}
exports.handleUsersCommand = handleUsersCommand;
//# sourceMappingURL=commands-handlers.js.map