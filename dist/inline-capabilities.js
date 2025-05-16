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
exports.setupInlineHandler = void 0;
const bot_1 = require("./bot");
const storage_1 = require("./ton-connect/storage");
/**
 * Setup inline query handler for the bot
 * This enables inline mode functionality where users can share transaction information in other chats
 */
function setupInlineHandler() {
    bot_1.bot.on('inline_query', (query) => __awaiter(this, void 0, void 0, function* () {
        try {
            yield handleInlineQuery(query);
        }
        catch (error) {
            console.error('Error handling inline query:', error);
            yield bot_1.bot.answerInlineQuery(query.id, [{
                    type: 'article',
                    id: 'error',
                    title: 'Error',
                    description: 'An error occurred while processing your query',
                    input_message_content: {
                        message_text: '❌ Error: Unable to process request. Please try again later.'
                    }
                }]);
        }
    }));
}
exports.setupInlineHandler = setupInlineHandler;
/**
 * Handle inline query from users
 */
function handleInlineQuery(query) {
    return __awaiter(this, void 0, void 0, function* () {
        const userId = query.from.id;
        const text = query.query.trim();
        // Default response for empty query
        if (!text) {
            yield bot_1.bot.answerInlineQuery(query.id, [
                {
                    type: 'article',
                    id: 'help',
                    title: 'Share Transaction Information',
                    description: 'Type a transaction ID or "my-wallet" to share your wallet information',
                    input_message_content: {
                        message_text: 'ℹ️ *TON Connect Bot Inline Mode*\n\nYou can use this bot to share:' +
                            '\n- Transaction information (enter a transaction ID)' +
                            '\n- Your wallet details (enter "my-wallet")',
                        parse_mode: 'Markdown'
                    }
                }
            ]);
            return;
        }
        // Handle "my-wallet" command
        if (text.toLowerCase() === 'my-wallet') {
            yield handleWalletInfoInline(query);
            return;
        }
        // Check if the text is a transaction ID
        const redisClient = yield (0, storage_1.getRedisClient)();
        const isTransaction = yield redisClient.hExists('transaction_submissions', text);
        if (isTransaction) {
            yield handleTransactionInline(query, text);
            return;
        }
        // If no specific command is matched, show a default response
        yield bot_1.bot.answerInlineQuery(query.id, [
            {
                type: 'article',
                id: 'not_found',
                title: 'No Data Found',
                description: `No transaction or command found for "${text}"`,
                input_message_content: {
                    message_text: '❌ No data found for the specified query.'
                }
            }
        ]);
    });
}
/**
 * Handle inline query for sharing wallet information
 */
function handleWalletInfoInline(query) {
    return __awaiter(this, void 0, void 0, function* () {
        const userId = query.from.id;
        // Get user's wallet data
        const userData = yield (0, storage_1.getUserData)(userId);
        if (!userData || !userData.walletAddress) {
            yield bot_1.bot.answerInlineQuery(query.id, [
                {
                    type: 'article',
                    id: 'no_wallet',
                    title: 'No Wallet Connected',
                    description: 'You need to connect a wallet first',
                    input_message_content: {
                        message_text: '❌ You need to connect a wallet first. Use /connect in a private chat with the bot.'
                    }
                }
            ]);
            return;
        }
        // Create a nicely formatted wallet information message
        const messageText = `💼 *TON Wallet Information*\n\n` +
            `👤 Owner: ${userData.displayName || 'User'}\n` +
            `📝 Address: \`${userData.walletAddress}\`\n` +
            `🔗 Connected: ${new Date(userData.connectionTimestamp).toLocaleString()}\n\n` +
            `_Shared via @${(process.env.BOT_USERNAME || 'ton_connect_example_bot')}_`;
        yield bot_1.bot.answerInlineQuery(query.id, [
            {
                type: 'article',
                id: 'wallet_info',
                title: 'Share Wallet Information',
                description: `Share your wallet address: ${userData.walletAddress.substring(0, 12)}...`,
                input_message_content: {
                    message_text: messageText,
                    parse_mode: 'Markdown'
                }
            }
        ]);
    });
}
/**
 * Handle inline query for sharing transaction information
 */
function handleTransactionInline(query, transactionId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Get transaction data
        const transaction = yield (0, storage_1.getTransactionSubmission)(transactionId);
        if (!transaction) {
            yield bot_1.bot.answerInlineQuery(query.id, [
                {
                    type: 'article',
                    id: 'tx_not_found',
                    title: 'Transaction Not Found',
                    description: `No transaction found with ID ${transactionId}`,
                    input_message_content: {
                        message_text: `❌ Transaction not found: ${transactionId}`
                    }
                }
            ]);
            return;
        }
        // Determine transaction status and icon
        let statusIcon = '⏳';
        let statusText = 'Pending';
        if (transaction.status === 'approved') {
            statusIcon = '✅';
            statusText = 'Approved';
        }
        else if (transaction.status === 'rejected') {
            statusIcon = '❌';
            statusText = 'Rejected';
        }
        // Format timestamp
        const timestamp = new Date(transaction.timestamp).toLocaleString();
        // Create message text
        const messageText = `${statusIcon} *TON Transaction*\n\n` +
            `🆔 ID: \`${transaction.id}\`\n` +
            `📊 Status: ${statusText}\n` +
            `⏰ Submitted: ${timestamp}\n` +
            (transaction.notes ? `📝 Notes: ${transaction.notes}\n` : '') +
            `\n_Shared via @${(process.env.BOT_USERNAME || 'ton_connect_example_bot')}_`;
        yield bot_1.bot.answerInlineQuery(query.id, [
            {
                type: 'article',
                id: 'transaction_info',
                title: `Transaction: ${statusText}`,
                description: `Transaction ID: ${transactionId}\nSubmitted: ${timestamp}`,
                input_message_content: {
                    message_text: messageText,
                    parse_mode: 'Markdown'
                }
            }
        ]);
    });
}
//# sourceMappingURL=inline-capabilities.js.map