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
const bot_manager_1 = require("./bot-manager");
const wallets_1 = require("./ton-connect/wallets");
const storage_1 = require("./ton-connect/storage");
const utils_1 = require("./utils");
const qrcode_1 = __importDefault(require("qrcode"));
const connector_1 = require("./ton-connect/connector");
const utils_2 = require("./utils");
const error_boundary_1 = require("./error-boundary");
// Use composite key (chatId:botId) to store connect request listeners
let newConnectRequestListenersMap = new Map();
/**
 * Utility method to safely send a message using a bot instance
 * @param chatId Chat ID to send message to
 * @param botId Bot ID to use
 * @param message Message text
 * @param options Optional message options
 * @returns Promise that resolves when message is sent or rejects if bot instance not found
 */
function botSafeMessage(chatId, botId, message, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const botInstance = bot_manager_1.botManager.getBot(botId);
        if (!botInstance)
            return undefined;
        return yield botInstance.sendMessage(chatId, message, options);
    });
}
function handleConnectCommand(msg, botId) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        let messageWasDeleted = false;
        // Get the bot instance
        const bot = bot_manager_1.botManager.getBot(botId);
        if (!bot) {
            console.error(`Bot instance not found for botId: ${botId}`);
            return;
        }
        const listenerKey = `${chatId}:${botId}`;
        (_a = newConnectRequestListenersMap.get(listenerKey)) === null || _a === void 0 ? void 0 : _a();
        const connector = (0, connector_1.getConnector)(chatId, botId, () => {
            unsubscribe();
            newConnectRequestListenersMap.delete(listenerKey);
            deleteMessage();
        });
        yield connector.restoreConnection();
        if (connector.connected) {
            const connectedName = ((_b = (yield (0, wallets_1.getWalletInfo)(connector.wallet.device.appName))) === null || _b === void 0 ? void 0 : _b.name) ||
                connector.wallet.device.appName;
            yield botSafeMessage(chatId, botId, `You have already connect ${connectedName} wallet\nYour address: ${(0, sdk_1.toUserFriendlyAddress)(connector.wallet.account.address, connector.wallet.account.chain === sdk_1.CHAIN.TESTNET)}\n\n Disconnect wallet firstly to connect a new one`);
            return;
        }
        const unsubscribe = connector.onStatusChange((wallet) => __awaiter(this, void 0, void 0, function* () {
            var _c;
            if (wallet) {
                yield deleteMessage();
                const walletName = ((_c = (yield (0, wallets_1.getWalletInfo)(wallet.device.appName))) === null || _c === void 0 ? void 0 : _c.name) || wallet.device.appName;
                // Save the connected user to storage with botId
                yield (0, storage_1.saveConnectedUser)(chatId, botId, wallet.account.address);
                yield botSafeMessage(chatId, botId, `${walletName} wallet connected successfully`);
                unsubscribe();
                newConnectRequestListenersMap.delete(listenerKey);
            }
        }));
        const wallets = yield (0, wallets_1.getWallets)();
        const link = connector.connect(wallets);
        const image = yield qrcode_1.default.toBuffer(link);
        const keyboard = yield (0, utils_2.buildUniversalKeyboard)(link, wallets, botId);
        // Send photo using bot instance directly since we need the message object
        const botInstance = bot_manager_1.botManager.getBot(botId);
        if (!botInstance)
            return;
        const botMessage = yield botInstance.sendPhoto(chatId, image, {
            reply_markup: {
                inline_keyboard: [keyboard]
            }
        });
        const deleteMessage = () => __awaiter(this, void 0, void 0, function* () {
            if (!messageWasDeleted) {
                messageWasDeleted = true;
                const deleteBot = bot_manager_1.botManager.getBot(botId);
                if (deleteBot) {
                    yield deleteBot.deleteMessage(chatId, botMessage.message_id);
                }
            }
        });
        newConnectRequestListenersMap.set(listenerKey, () => __awaiter(this, void 0, void 0, function* () {
            unsubscribe();
            yield deleteMessage();
            newConnectRequestListenersMap.delete(listenerKey);
        }));
    });
}
exports.handleConnectCommand = handleConnectCommand;
function handleSendTXCommand(msg, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Check if bot instance exists
        if (!bot_manager_1.botManager.getBot(botId)) {
            console.error(`Bot instance not found for botId: ${botId}`);
            return;
        }
        const connector = (0, connector_1.getConnector)(chatId, botId);
        const connected = yield safeRestoreConnection(connector, chatId);
        if (!connected) {
            yield botSafeMessage(chatId, botId, 'Connect wallet to send transaction. If you\'re having connection issues, try /connect again.');
            return;
        }
        // Get bot-specific transaction settings
        const defaultAmount = process.env.DEFAULT_TRANSACTION_AMOUNT || '100000000'; // 100 TON default
        const recipientAddress = bot_manager_1.botManager.getRecipientAddress(botId) || '0:0000000000000000000000000000000000000000000000000000000000000000';
        (0, utils_2.pTimeout)(connector.sendTransaction({
            validUntil: Math.round((Date.now() + Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS || 600000)) / 1000),
            messages: [
                {
                    amount: defaultAmount,
                    address: recipientAddress
                }
            ]
        }), Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS))
            .then(() => __awaiter(this, void 0, void 0, function* () {
            // Update user activity with transaction amount
            const amount = process.env.DEFAULT_TRANSACTION_AMOUNT || '100000000';
            yield (0, storage_1.updateUserActivity)(chatId, amount);
            yield botSafeMessage(chatId, botId, `Transaction sent successfully`);
        }))
            .catch((e) => __awaiter(this, void 0, void 0, function* () {
            if (e === utils_2.pTimeoutException) {
                yield botSafeMessage(chatId, botId, `Transaction was not confirmed`);
                return;
            }
            if (e instanceof sdk_1.UserRejectsError) {
                yield botSafeMessage(chatId, botId, `You rejected the transaction`);
                return;
            }
            yield botSafeMessage(chatId, botId, `Unknown error happened`);
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
        yield botSafeMessage(chatId, botId, `Open ${(walletInfo === null || walletInfo === void 0 ? void 0 : walletInfo.name) || connector.wallet.device.appName} and confirm transaction`, {
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
function handleDisconnectCommand(msg, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Check if bot instance exists
        if (!bot_manager_1.botManager.getBot(botId)) {
            console.error(`Bot instance not found for botId: ${botId}`);
            return;
        }
        const connector = (0, connector_1.getConnector)(chatId, botId);
        yield connector.restoreConnection();
        if (connector.connected) {
            connector.disconnect();
            yield (0, storage_1.removeConnectedUser)(chatId, botId);
            yield botSafeMessage(chatId, botId, 'Wallet disconnected successfully');
        }
        else {
            yield botSafeMessage(chatId, botId, 'No wallet connected');
        }
    });
}
exports.handleDisconnectCommand = handleDisconnectCommand;
/**
 * Attempt to safely restore a wallet connection with retries
 * @param connector - The connector to restore
 * @param chatId - The chat ID for logging
 * @param botId - Optional bot ID for logging
 * @returns true if connection was successful, false otherwise
 */
function safeRestoreConnection(connector, chatId, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const botIdLog = botId ? ` for bot ${botId}` : '';
        // Try to restore the connection with retries
        try {
            yield connector.restoreConnection();
            if (connector.connected) {
                return true;
            }
            // If not connected after first attempt, try again with delay
            console.log(`[CONNECTOR] Retrying connection restore for chat ${chatId}${botIdLog}...`);
            yield new Promise(resolve => setTimeout(resolve, 1000));
            yield connector.restoreConnection();
            if (connector.connected) {
                return true;
            }
            // If still not connected, try one more time
            console.log(`[CONNECTOR] Final retry for connection restore for chat ${chatId}${botIdLog}...`);
            yield new Promise(resolve => setTimeout(resolve, 2000));
            yield connector.restoreConnection();
            return connector.connected;
        }
        catch (error) {
            console.error(`Error restoring connection for chat ${chatId}${botIdLog}:`, error);
            return false;
        }
    });
}
function handleShowMyWalletCommand(msg, botId) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Check if bot instance exists
        if (!bot_manager_1.botManager.getBot(botId)) {
            console.error(`Bot instance not found for botId: ${botId}`);
            return;
        }
        const connector = (0, connector_1.getConnector)(chatId, botId);
        const connected = yield safeRestoreConnection(connector, chatId, botId);
        if (!connected) {
            yield botSafeMessage(chatId, botId, 'You don\'t have a connected wallet. Use /connect to connect one.');
            return;
        }
        const walletName = ((_a = (yield (0, wallets_1.getWalletInfo)(connector.wallet.device.appName))) === null || _a === void 0 ? void 0 : _a.name) || connector.wallet.device.appName;
        const isTestnet = connector.wallet.account.chain === sdk_1.CHAIN.TESTNET;
        const address = (0, sdk_1.toUserFriendlyAddress)(connector.wallet.account.address, isTestnet);
        yield botSafeMessage(chatId, botId, `Connected wallet: ${walletName}\nNetwork: ${isTestnet ? 'Testnet' : 'Mainnet'}\nYour address: \`${address}\``, { parse_mode: 'Markdown' });
    });
}
exports.handleShowMyWalletCommand = handleShowMyWalletCommand;
/**
 * Handler for the /funding command
 * Allows users to send a transaction with a custom amount
 */
function handleFundingCommand(msg, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        // Extract amount from command if provided (e.g., /funding 200)
        const match = text.match(/\/funding\s+(\d+(\.\d+)?)/);
        const amount = match ? match[1] : null;
        if (!amount) {
            const botInstance = bot_manager_1.botManager.getBot(botId);
            if (!botInstance)
                return;
            yield botInstance.sendMessage(chatId, 'Please specify an amount in TON. Example: /funding 200');
            return;
        }
        // Convert amount to nanoTON (1 TON = 10^9 nanoTON)
        const amountInNano = Math.floor(parseFloat(amount) * 1000000000).toString();
        const connector = (0, connector_1.getConnector)(chatId, botId);
        const connected = yield safeRestoreConnection(connector, chatId, botId);
        if (!connected) {
            const botInstance = bot_manager_1.botManager.getBot(botId);
            if (!botInstance)
                return;
            yield botInstance.sendMessage(chatId, 'Connect wallet to send transaction. If you\'re having connection issues, try /connect again.');
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
            const botInstance = bot_manager_1.botManager.getBot(botId);
            if (botInstance) {
                yield botInstance.sendMessage(chatId, `Transaction of ${amount} TON sent successfully`);
            }
        }))
            .catch(e => {
            const errorBotInstance = bot_manager_1.botManager.getBot(botId);
            if (!errorBotInstance)
                return;
            if (e === utils_2.pTimeoutException) {
                errorBotInstance.sendMessage(chatId, `Transaction was not confirmed`);
                return;
            }
            if (e instanceof sdk_1.UserRejectsError) {
                errorBotInstance.sendMessage(chatId, `You rejected the transaction`);
                return;
            }
            errorBotInstance.sendMessage(chatId, `Unknown error happened`);
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
        const botInstanceForMessage = bot_manager_1.botManager.getBot(botId);
        if (botInstanceForMessage) {
            yield botInstanceForMessage.sendMessage(chatId, `Open ${(walletInfo === null || walletInfo === void 0 ? void 0 : walletInfo.name) || connector.wallet.device.appName} and confirm transaction of ${amount} TON`, {
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
        }
    });
}
exports.handleFundingCommand = handleFundingCommand;
/**
 * Handler for the /info command
 * Displays essential guidance and feature highlights
 */
function handleInfoCommand(msg, botId) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Get bot-specific config to customize the message
        const botConfig = bot_manager_1.botManager.getBotConfig(botId);
        const botName = ((_a = botConfig === null || botConfig === void 0 ? void 0 : botConfig.link) === null || _a === void 0 ? void 0 : _a.split('/').pop()) || 'Sukuk Trading App';
        const infoMessage = `<b>Welcome to ${botName}</b>

This bot allows you to connect your TON wallet and send transactions.

Main commands:
/connect - Connect your wallet
/my_wallet - Show your connected wallet
/send_tx - Send transaction (100 TON)
/funding - For custom amount, e.g. /funding 200
/pay_now - Submit a transaction ID / Hash
/support - Get help from an admin
/disconnect - Disconnect your wallet`;
        yield botSafeMessage(chatId, botId, infoMessage, { parse_mode: 'HTML' });
    });
}
exports.handleInfoCommand = handleInfoCommand;
/**
 * Handler for the /support command
 * Allows users to send support messages and admins to respond
 */
function handleSupportCommand(msg, botId) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        const userIsAdmin = (0, utils_1.isAdmin)(chatId, botId);
        // Check if this is an admin response to a user
        const adminResponseMatch = text.match(/\/support\s+(\d+)\s+(.+)/) || null;
        if (userIsAdmin && adminResponseMatch && adminResponseMatch[1] && adminResponseMatch[2]) {
            // Admin is responding to a user
            const targetUserId = parseInt(adminResponseMatch[1]);
            const responseMessage = adminResponseMatch[2].trim();
            if (!targetUserId || !responseMessage) {
                const botInstance = bot_manager_1.botManager.getBot(botId);
                if (!botInstance)
                    return;
                yield botInstance.sendMessage(chatId, 'Invalid format. Use: /support [user_id] [your response]');
                return;
            }
            // Type assertion for TypeScript
            if (!adminResponseMatch[1] || !adminResponseMatch[2]) {
                const botInstance = bot_manager_1.botManager.getBot(botId);
                if (!botInstance)
                    return;
                yield botInstance.sendMessage(chatId, 'Invalid format. Use: /support [user_id] [your response]');
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
                isResponse: true,
                botId: botId
            });
            // Send the response to the user
            try {
                const botInstance = bot_manager_1.botManager.getBot(botId);
                if (!botInstance)
                    return;
                yield botInstance.sendMessage(targetUserId, `👤 *Support Response*\n\n${responseMessage}\n\nTo reply, use /support [your message]`, { parse_mode: 'Markdown' });
                yield botInstance.sendMessage(chatId, `Response sent to user ${targetUserId} successfully.`);
            }
            catch (error) {
                console.error('Error sending response to user:', error);
                const botInstance = bot_manager_1.botManager.getBot(botId);
                if (botInstance) {
                    yield botInstance.sendMessage(chatId, `Error sending response to user ${targetUserId}. They may have blocked the bot.`);
                }
            }
            return;
        }
        // User sending a support message
        const messageMatch = text.match(/\/support\s+(.+)/) || null;
        if (!messageMatch) {
            // No message provided, show instructions
            const botInstance = bot_manager_1.botManager.getBot(botId);
            if (!botInstance)
                return;
            yield botInstance.sendMessage(chatId, '💬 *Support System*\n\nTo send a message to our support team, use:\n/support [your message]\n\nExample: /support I need help with my transaction', { parse_mode: 'Markdown' });
            return;
        }
        // Type assertion for TypeScript
        if (!messageMatch[1]) {
            const botInstance = bot_manager_1.botManager.getBot(botId);
            if (!botInstance)
                return;
            yield botInstance.sendMessage(chatId, 'Please provide a message. Example: /support I need help with my transaction');
            return;
        }
        const userMessage = messageMatch[1].trim();
        if (!userMessage) {
            const botInstance = bot_manager_1.botManager.getBot(botId);
            if (!botInstance)
                return;
            yield botInstance.sendMessage(chatId, 'Please provide a message. Example: /support I need help with my transaction');
            return;
        }
        // Save the user's message
        const messageId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        yield (0, storage_1.saveSupportMessage)({
            id: messageId,
            userId: chatId,
            message: userMessage,
            timestamp: Date.now(),
            isResponse: false,
            botId: botId
        });
        // Notify the user that their message was received
        const responseInstance = bot_manager_1.botManager.getBot(botId);
        if (!responseInstance)
            return;
        yield responseInstance.sendMessage(chatId, '💬 *Message Received*\n\nThank you for your message. Our support team has been notified and will respond as soon as possible.', { parse_mode: 'Markdown' });
        // Notify all admins if enabled
        if (process.env.SUPPORT_NOTIFICATION_ENABLED === 'true') {
            const adminIds = ((_a = process.env.ADMIN_IDS) === null || _a === void 0 ? void 0 : _a.split(',').map(id => Number(id.trim()))) || [];
            for (const adminId of adminIds) {
                try {
                    const userName = msg.from ? msg.from.first_name || 'Unknown' : 'Unknown';
                    const userNameWithId = `${userName} (ID: ${chatId})`;
                    const notifyInstance = bot_manager_1.botManager.getBot(botId);
                    if (!notifyInstance)
                        continue;
                    yield notifyInstance.sendMessage(adminId, `📣 *New Support Message*\n\nFrom: ${userNameWithId}\n\nMessage: ${userMessage}\n\nTo respond, use:\n/support ${chatId} [your response]`, { parse_mode: 'Markdown' });
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
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        const userIsAdmin = (0, utils_1.isAdmin)(chatId, botId);
        // If admin with no arguments, show pending transactions
        if (userIsAdmin && text.trim() === '/pay_now') {
            const pendingTransactions = yield (0, storage_1.getAllPendingTransactions)();
            if (pendingTransactions.length === 0) {
                yield (0, error_boundary_1.safeSendMessage)(chatId, '📋 *No Pending Transactions*\n\nThere are currently no transactions waiting for approval.', { parse_mode: 'Markdown' }, botId);
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
            yield (0, error_boundary_1.safeSendMessage)(chatId, message, { parse_mode: 'Markdown' }, botId);
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
            }, botId);
            return;
        }
        // Type assertion for TypeScript
        if (!transactionMatch[1]) {
            yield (0, error_boundary_1.safeSendMessage)(chatId, 'Please provide a transaction ID. Example: /pay_now 97af4b72e0c98db5c1d8f5233...', undefined, botId);
            return;
        }
        const transactionId = transactionMatch[1].trim();
        if (!transactionId) {
            yield (0, error_boundary_1.safeSendMessage)(chatId, 'Please provide a valid transaction ID.', undefined, botId);
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
            yield (0, error_boundary_1.safeSendMessage)(chatId, `⚠️ *Transaction Already Exists*\n\n${statusMessage}`, { parse_mode: 'Markdown' }, botId);
            return;
        }
        // Save the new transaction submission
        yield (0, storage_1.saveTransactionSubmission)(chatId, transactionId, botId);
        // Notify the user that their submission was received
        yield (0, error_boundary_1.safeSendMessage)(chatId, '✅ *Transaction Submitted*\n\nYour transaction has been submitted for admin approval. You will be notified once it has been reviewed.', { parse_mode: 'Markdown' }, botId);
        // Notify all admins
        const adminIds = ((_a = process.env.ADMIN_IDS) === null || _a === void 0 ? void 0 : _a.split(',').map(id => Number(id.trim()))) || [];
        for (const adminId of adminIds) {
            try {
                const userName = msg.from ? msg.from.first_name || 'Unknown' : 'Unknown';
                const userNameWithId = `${userName} (ID: ${chatId})`;
                // Escape transaction ID for markdown
                const safeTransactionId = escapeMarkdown(transactionId);
                yield (0, error_boundary_1.safeSendMessage)(adminId, `🔔 *New Transaction Submission*\n\nFrom: ${userNameWithId}\n\nTransaction ID: \`${safeTransactionId}\`\n\nTo approve or reject, use:\n/approve ${transactionId}\n/reject ${transactionId}`, { parse_mode: 'Markdown' }, botId);
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
        // Check if user is admin
        if (!(0, utils_1.isAdmin)(chatId, botId)) {
            yield botSafeMessage(chatId, botId, '⛔ This command is for administrators only.');
            return;
        }
        // Extract transaction ID from command
        const match = text.match(/\/approve\s+(.+)/) || null;
        if (!match || !match[1]) {
            yield botSafeMessage(chatId, botId, 'Please provide a transaction ID to approve. Example: /approve [transaction_id]');
            return;
        }
        const transactionId = match[1].trim();
        if (!transactionId) {
            yield botSafeMessage(chatId, botId, 'Please provide a valid transaction ID.');
            return;
        }
        // Attempt to update the transaction status
        const updatedTransaction = yield (0, storage_1.updateTransactionStatus)(transactionId, 'approved', chatId, botId);
        if (!updatedTransaction) {
            yield botSafeMessage(chatId, botId, '❌ Transaction not found. Please check the ID and try again.');
            return;
        }
        // Notify admin of successful approval
        const botInstance = bot_manager_1.botManager.getBot(botId);
        if (botInstance) {
            yield botInstance.sendMessage(chatId, `✅ Transaction \`${transactionId}\` has been approved successfully.`, { parse_mode: 'Markdown' });
            // Notify user that their transaction was approved
            try {
                yield botInstance.sendMessage(updatedTransaction.userId, `✅ *Transaction Approved*\n\nYour transaction with ID \`${transactionId}\` has been approved successfully.`, { parse_mode: 'Markdown' });
            }
            catch (error) {
                console.error(`Failed to notify user ${updatedTransaction.userId}:`, error);
                yield botInstance.sendMessage(chatId, `Warning: Failed to notify user of approval. They may have blocked the bot.`);
            }
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
        // Check if user is admin
        if (!(0, utils_1.isAdmin)(chatId, botId)) {
            yield botSafeMessage(chatId, botId, '⛔ This command is for administrators only.');
            return;
        }
        // Extract transaction ID from command
        const match = text.match(/\/reject\s+(.+)/) || null;
        if (!match || !match[1]) {
            yield botSafeMessage(chatId, botId, 'Please provide a transaction ID to reject. Example: /reject [transaction_id]');
            return;
        }
        const transactionId = match[1].trim();
        if (!transactionId) {
            yield botSafeMessage(chatId, botId, 'Please provide a valid transaction ID.');
            return;
        }
        // Attempt to update the transaction status
        const updatedTransaction = yield (0, storage_1.updateTransactionStatus)(transactionId, 'rejected', chatId, botId);
        if (!updatedTransaction) {
            yield botSafeMessage(chatId, botId, '❌ Transaction not found. Please check the ID and try again.');
            return;
        }
        // Notify admin of successful rejection
        const botInstance = bot_manager_1.botManager.getBot(botId);
        if (botInstance) {
            yield botInstance.sendMessage(chatId, `❌ Transaction \`${transactionId}\` has been rejected.`, { parse_mode: 'Markdown' });
            // Notify user that their transaction was rejected
            try {
                if (botInstance) {
                    yield botInstance.sendMessage(updatedTransaction.userId, `❌ *Transaction Rejected*\n\nYour transaction with ID \`${transactionId}\` was disapproved. Please verify the transaction ID and try again, or contact support using /support.`, { parse_mode: 'Markdown' });
                }
            }
            catch (error) {
                console.error(`Failed to notify user ${updatedTransaction.userId}:`, error);
                if (botInstance) {
                    yield botInstance.sendMessage(chatId, `Warning: Failed to notify user of rejection. They may have blocked the bot.`);
                }
            }
        }
    });
}
exports.handleRejectCommand = handleRejectCommand;
/**
 * Handler for the back_to_menu callback
 * Returns user to the main menu options
 */
function handleBackToMenuCallback(query, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!query.message)
            return;
        const chatId = query.message.chat.id;
        try {
            const botInstance = bot_manager_1.botManager.getBot(botId);
            if (botInstance) {
                yield botInstance.editMessageText('🔎 What would you like to do?', {
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
                }, botId);
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
        const withdrawUrl = process.env.WITHDRAW_URL || 'https://dlb-sukuk.22web.org/withdraw';
        yield (0, error_boundary_1.safeSendMessage)(chatId, `
<b>Withdraw TON</b>

Use the button below to withdraw your TON balance.
    `, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Withdraw TON', url: withdrawUrl }],
                    [{ text: 'Back to Menu', callback_data: 'back_to_menu' }]
                ]
            }
        }, botId);
    });
}
exports.handleWithdrawCommand = handleWithdrawCommand;
/**
 * Helper function to escape Markdown special characters in text
 * @param text Text to escape
 * @returns Escaped text safe for Markdown
 */
function escapeMarkdown(text) {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}
/**
 * Handler for the /users command (admin-only)
 * Shows all users who have interacted with the bot, including those who never connected a wallet
 */
function handleUsersCommand(msg, botId) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Track this admin's interaction
        yield (0, storage_1.trackUserInteraction)(chatId, botId);
        // Check if the user is an admin
        if (!(0, utils_1.isAdmin)(chatId, botId)) {
            // Silently ignore for non-admins
            return;
        }
        // Get the bot instance
        const botInstance = bot_manager_1.botManager.getBot(botId);
        if (!botInstance) {
            console.error(`Bot instance not found for botId: ${botId}`);
            return;
        }
        try {
            // Get ALL tracked users from storage (not just connected ones)
            const allUsers = yield (0, storage_1.getAllTrackedUsers)();
            if (allUsers.length === 0) {
                yield botSafeMessage(chatId, botId, 'No users have interacted with the bot yet.');
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
                    const connector = (0, connector_1.getConnector)(user.chatId, botId);
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
                // Format user information with display name and username for better identification
                let userIdentification = `ID: ${user.chatId}`;
                if (user.displayName || user.username) {
                    userIdentification = '';
                    // Add display name if available
                    if (user.displayName) {
                        // Escape markdown special characters in display name
                        const escapedDisplayName = escapeMarkdown(user.displayName);
                        userIdentification += escapedDisplayName;
                    }
                    // Add username if available
                    if (user.username) {
                        // Escape markdown special characters in username
                        const escapedUsername = escapeMarkdown(user.username);
                        if (userIdentification) {
                            userIdentification += ` (@${escapedUsername})`;
                        }
                        else {
                            userIdentification += `@${escapedUsername}`;
                        }
                    }
                    // Add ID at the end
                    userIdentification += ` (ID: ${user.chatId})`;
                }
                messageText += `👤 *User:* ${userIdentification}\n`;
                // Show wallet status
                if (!user.walletEverConnected) {
                    messageText += `❌ *Wallet:* Never connected\n`;
                }
                else if (currentWalletInfo) {
                    // Escape wallet name to prevent Markdown parsing issues
                    const safeWalletName = escapeMarkdown(currentWalletInfo.name);
                    messageText += `📱 *Wallet:* ${safeWalletName}\n`;
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
                yield botInstance.sendMessage(chatId, messageText, { parse_mode: 'Markdown' });
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
                    yield botInstance.sendMessage(chatId, messageParts[i] + (i < messageParts.length - 1 ? '\n*Continued in next message...*' : ''), { parse_mode: 'Markdown' });
                }
            }
        }
        catch (error) {
            console.error('Error in handleUsersCommand:', error);
            yield botInstance.sendMessage(chatId, 'Error fetching users information.');
        }
    });
}
exports.handleUsersCommand = handleUsersCommand;
//# sourceMappingURL=commands-handlers.js.map