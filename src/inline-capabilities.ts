import TelegramBot from 'node-telegram-bot-api';
import { bot } from './bot';
import { withErrorHandling } from './error-handler';
import { getRedisClient, getTransactionSubmission, getUserData } from './ton-connect/storage';

/**
 * Setup inline query handler for the bot
 * This enables inline mode functionality where users can share transaction information in other chats
 */
export function setupInlineHandler(): void {
    bot.on('inline_query', async (query) => {
        try {
            await handleInlineQuery(query);
        } catch (error) {
            console.error('Error handling inline query:', error);
            await bot.answerInlineQuery(query.id, [{
                type: 'article',
                id: 'error',
                title: 'Error',
                description: 'An error occurred while processing your query',
                input_message_content: {
                    message_text: '❌ Error: Unable to process request. Please try again later.'
                }
            }]);
        }
    });
}

/**
 * Handle inline query from users
 */
async function handleInlineQuery(query: TelegramBot.InlineQuery): Promise<void> {
    const userId = query.from.id;
    const text = query.query.trim();
    
    // Default response for empty query
    if (!text) {
        await bot.answerInlineQuery(query.id, [
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
        await handleWalletInfoInline(query);
        return;
    }
    
    // Check if the text is a transaction ID
    const redisClient = await getRedisClient();
    const isTransaction = await redisClient.hExists('transaction_submissions', text);
    
    if (isTransaction) {
        await handleTransactionInline(query, text);
        return;
    }
    
    // If no specific command is matched, show a default response
    await bot.answerInlineQuery(query.id, [
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
}

/**
 * Handle inline query for sharing wallet information
 */
async function handleWalletInfoInline(query: TelegramBot.InlineQuery): Promise<void> {
    const userId = query.from.id;
    
    // Get user's wallet data
    const userData = await getUserData(userId);
    
    if (!userData || !userData.walletAddress) {
        await bot.answerInlineQuery(query.id, [
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
    
    await bot.answerInlineQuery(query.id, [
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
}

/**
 * Handle inline query for sharing transaction information
 */
async function handleTransactionInline(query: TelegramBot.InlineQuery, transactionId: string): Promise<void> {
    // Get transaction data
    const transaction = await getTransactionSubmission(transactionId);
    
    if (!transaction) {
        await bot.answerInlineQuery(query.id, [
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
    } else if (transaction.status === 'rejected') {
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
    
    await bot.answerInlineQuery(query.id, [
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
}
