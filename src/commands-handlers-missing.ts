import { CHAIN, isTelegramUrl, toUserFriendlyAddress, UserRejectsError } from '@tonconnect/sdk';
import { getWallets, getWalletInfo } from './ton-connect/wallets';
import { BotFactory } from './bot-factory';
import { 
    saveConnectedUser, 
    removeConnectedUser, 
    updateUserActivity, 
    getAllConnectedUsers, 
    saveSupportMessage, 
    getSupportMessagesForUser, 
    saveTransactionSubmission, 
    updateTransactionStatus, 
    getTransactionSubmission, 
    getAllPendingTransactions, 
    TransactionSubmission, 
    trackUserInteraction, 
    getAllTrackedUsers 
} from './ton-connect/storage';
import { isAdmin } from './utils';
import TelegramBot from 'node-telegram-bot-api';
import { getConnector } from './ton-connect/connector';
import { addTGReturnStrategy, pTimeout, pTimeoutException } from './utils';
import { safeSendMessage } from './error-boundary';
import { safeRestoreConnection } from './commands-handlers';

/**
 * Helper function to escape Markdown special characters in text
 * @param text Text to escape
 * @returns Escaped text safe for Markdown
 */
function escapeMarkdown(text: string): string {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

/**
 * Handler for the /funding command
 * Allows users to send a transaction with a custom amount
 */
export async function handleFundingCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    // Get the bot instance for this botId
    const botFactory = BotFactory.getInstance();
    const bot = botFactory.getBot(botId);
    if (!bot) {
        console.error(`Bot with ID ${botId} not found`);
        return;
    }
    
    // Extract amount from command if provided (e.g., /funding 200)
    const match = text.match(/\/funding\s+(\d+(\.\d+)?)/);
    const amount = match ? match[1] : null;
    
    if (!amount) {
        await bot.sendMessage(chatId, 'Please specify an amount in TON. Example: /funding 200');
        return;
    }
    
    // Convert amount to nanoTON (1 TON = 10^9 nanoTON)
    const amountInNano = Math.floor(parseFloat(amount) * 1000000000).toString();
    
    const connector = getConnector(chatId, botId);
    
    const connected = await safeRestoreConnection(connector, chatId, botId);
    if (!connected) {
        await bot.sendMessage(chatId, 'Connect wallet to send transaction. If you\'re having connection issues, try /connect again.');
        return;
    }
    
    pTimeout(
    connector.sendTransaction({
        validUntil: Math.round(
            (Date.now() + Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS)) / 1000
        ),
        messages: [
            {
                amount: amountInNano,
                address: process.env.DEFAULT_RECIPIENT_ADDRESS || '0:0000000000000000000000000000000000000000000000000000000000000000'
            }
        ]
    }),
    Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS)
    )
        .then(async () => {
            // Update user activity with transaction amount
            await updateUserActivity(chatId, botId, amountInNano);
            await bot.sendMessage(chatId, `Transaction of ${amount} TON sent successfully`);
        })
        .catch(async (e) => {
            if (e === pTimeoutException) {
                await bot.sendMessage(chatId, `Transaction was not confirmed`);
                return;
            }

            if (e instanceof UserRejectsError) {
                await bot.sendMessage(chatId, `You rejected the transaction`);
                return;
            }

            await bot.sendMessage(chatId, `Unknown error happened`);
        })
        .finally(() => connector.pauseConnection());

    let deeplink = '';
    const walletInfo = await getWalletInfo(connector.wallet!.device.appName);
    if (walletInfo) {
        deeplink = walletInfo.universalLink;
    }

    if (isTelegramUrl(deeplink)) {
        const url = new URL(deeplink);
        url.searchParams.append('startattach', 'tonconnect');
        deeplink = addTGReturnStrategy(url.toString(), process.env.TELEGRAM_BOT_LINK!);
    }

    await bot.sendMessage(
        chatId,
        `Open ${walletInfo?.name || connector.wallet!.device.appName} and confirm transaction of ${amount} TON`,
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: `Open ${walletInfo?.name || connector.wallet!.device.appName}`,
                            url: deeplink
                        }
                    ]
                ]
            }
        }
    );
}

/**
 * Handler for the /info command
 * Displays essential guidance and feature highlights
 */
export async function handleInfoCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    
    // Get the bot instance for this botId
    const botFactory = BotFactory.getInstance();
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
    
    await bot.sendMessage(chatId, infoMessage, { parse_mode: 'HTML' });
}

/**
 * Handler for the /support command
 * Allows users to send support messages and admins to respond
 */
export async function handleSupportCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    // Get the bot instance for this botId
    const botFactory = BotFactory.getInstance();
    const bot = botFactory.getBot(botId);
    if (!bot) {
        console.error(`Bot with ID ${botId} not found`);
        return;
    }
    
    const userIsAdmin = isAdmin(chatId, botId);
    
    // Check if this is an admin response to a user
    const adminResponseMatch = text.match(/\/support\s+(\d+)\s+(.+)/) || null;
    
    if (userIsAdmin && adminResponseMatch && adminResponseMatch[1] && adminResponseMatch[2]) {
        // Admin is responding to a user
        const targetUserId = parseInt(adminResponseMatch[1]);
        const responseMessage = adminResponseMatch[2].trim();
        
        if (!targetUserId || !responseMessage) {
            await bot.sendMessage(chatId, 'Invalid format. Use: /support [user_id] [your response]');
            return;
        }
        
        // Save the admin's response
        const messageId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        await saveSupportMessage({
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
            await bot.sendMessage(
                targetUserId,
                `👤 *Support Response*\n\n${responseMessage}\n\nTo reply, use /support [your message]`,
                { parse_mode: 'Markdown' }
            );
            await bot.sendMessage(chatId, `Response sent to user ${targetUserId} successfully.`);
        } catch (error) {
            console.error('Error sending response to user:', error);
            await bot.sendMessage(chatId, `Error sending response to user ${targetUserId}. They may have blocked the bot.`);
        }
        
        return;
    }
    
    // User sending a support message
    const messageMatch = text.match(/\/support\s+(.+)/) || null;
    
    if (!messageMatch) {
        // No message provided, show instructions
        await bot.sendMessage(
            chatId,
            '💬 *Support System*\n\nTo send a message to our support team, use:\n/support [your message]\n\nExample: /support I need help with my transaction',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    if (!messageMatch[1]) {
        await bot.sendMessage(chatId, 'Please provide a message. Example: /support I need help with my transaction');
        return;
    }
    
    const userMessage = messageMatch[1].trim();
    if (!userMessage) {
        await bot.sendMessage(chatId, 'Please provide a message. Example: /support I need help with my transaction');
        return;
    }
    
    // Save the user's message
    const messageId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    await saveSupportMessage({
        id: messageId,
        userId: chatId,
        botId: botId,
        message: userMessage,
        timestamp: Date.now(),
        isResponse: false
    });
    
    // Notify the user that their message was received
    await bot.sendMessage(
        chatId,
        '💬 *Message Received*\n\nThank you for your message. Our support team has been notified and will respond as soon as possible.',
        { parse_mode: 'Markdown' }
    );
    
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
                
                await bot.sendMessage(
                    adminId,
                    `📣 *New Support Message*\n\nFrom: ${userNameWithId}\n\nMessage: ${userMessage}\n\nTo respond, use:\n/support ${chatId} [your response]`,
                    { parse_mode: 'Markdown' }
                );
            } catch (error) {
                console.error(`Failed to notify admin ${adminId}:`, error);
            }
        }
    }
}

/**
 * Handler for the /pay_now command
 * Allows users to submit transaction IDs for admin approval
 * If user is admin, it shows pending transaction submissions
 */
export async function handlePayNowCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    // Get the bot instance for this botId
    const botFactory = BotFactory.getInstance();
    const bot = botFactory.getBot(botId);
    if (!bot) {
        console.error(`Bot with ID ${botId} not found`);
        return;
    }
    
    const userIsAdmin = isAdmin(chatId, botId);
    
    // If admin with no arguments, show pending transactions
    if (userIsAdmin && text.trim() === '/pay_now') {
        const pendingTransactions = await getAllPendingTransactions();
        
        if (pendingTransactions.length === 0) {
            await safeSendMessage(chatId, '📋 *No Pending Transactions*\n\nThere are currently no transactions waiting for approval.', { parse_mode: 'Markdown' });
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
        
        message += 'To approve or reject a transaction, use:\n'
        message += '/approve [transaction_id]\n'
        message += '/reject [transaction_id]';
        
        await safeSendMessage(chatId, message, { parse_mode: 'Markdown' });
        return;
    }
    
    // User submitting a new transaction
    const transactionMatch = text.match(/\/pay_now\s+(.+)/) || null;
    
    if (!transactionMatch) {
        // No transaction ID provided, show instructions
        await safeSendMessage(
            chatId,
            '💸 *Transaction Submission*\n\nTo submit a transaction for approval, use:\n/pay_now [transaction_id]\n\nExample: /pay_now 97af4b72e0c98db5c1d8f5233...',
            { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '« Back to Menu', callback_data: JSON.stringify({ method: 'back_to_menu', data: '' }) }
                    ]]
                }
            }
        );
        return;
    }
    
    if (!transactionMatch[1]) {
        await safeSendMessage(chatId, 'Please provide a transaction ID. Example: /pay_now 97af4b72e0c98db5c1d8f5233...');
        return;
    }
    
    const transactionId = transactionMatch[1].trim();
    if (!transactionId) {
        await safeSendMessage(chatId, 'Please provide a valid transaction ID.');
        return;
    }
    
    // Check if this transaction ID has already been submitted
    const existingSubmission = await getTransactionSubmission(transactionId);
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
        
        await safeSendMessage(chatId, `⚠️ *Transaction Already Exists*\n\n${statusMessage}`, { parse_mode: 'Markdown' });
        return;
    }
    
    // Save the new transaction submission
    await saveTransactionSubmission(chatId, botId, transactionId);
    
    // Notify the user that their submission was received
    await safeSendMessage(
        chatId,
        '✅ *Transaction Submitted*\n\nYour transaction has been submitted for admin approval. You will be notified once it has been reviewed.',
        { parse_mode: 'Markdown' }
    );
    
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
            
            await safeSendMessage(
                adminId,
                `🔔 *New Transaction Submission*\n\nFrom: ${userNameWithId}\n\nTransaction ID: \`${safeTransactionId}\`\n\nTo approve or reject, use:\n/approve ${transactionId}\n/reject ${transactionId}`,
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            console.error(`Failed to notify admin ${adminId}:`, error);
        }
    }
}

/**
 * Handler for the /approve command (admin-only)
 * Approves a transaction submission
 */
export async function handleApproveCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    // Get the bot instance for this botId
    const botFactory = BotFactory.getInstance();
    const bot = botFactory.getBot(botId);
    if (!bot) {
        console.error(`Bot with ID ${botId} not found`);
        return;
    }
    
    // Check if user is admin
    if (!isAdmin(chatId, botId)) {
        await bot.sendMessage(chatId, '⛔ This command is for administrators only.');
        return;
    }
    
    // Extract transaction ID from command
    const match = text.match(/\/approve\s+([\w-]+)(?:\s+(.*))?/);
    if (!match || !match[1]) {
        await bot.sendMessage(chatId, 'Please provide a transaction ID to approve. Example: /approve [transaction_id]');
        return;
    }
    
    const transactionId = match[1].trim();
    if (!transactionId) {
        await bot.sendMessage(chatId, 'Please provide a valid transaction ID.');
        return;
    }
    
    // Attempt to update the transaction status
    const updatedTransaction = await updateTransactionStatus(transactionId, botId, 'approved', chatId);
    
    if (!updatedTransaction) {
        await bot.sendMessage(chatId, '❌ Transaction not found. Please check the ID and try again.');
        return;
    }
    
    // Notify admin of successful approval
    await bot.sendMessage(chatId, `✅ Transaction \`${transactionId}\` has been approved successfully.`, { parse_mode: 'Markdown' });
    
    // Notify user that their transaction was approved
    try {
        await bot.sendMessage(
            updatedTransaction.userId,
            `✅ *Transaction Approved*\n\nYour transaction with ID \`${transactionId}\` has been approved successfully.`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error(`Failed to notify user ${updatedTransaction.userId}:`, error);
        await bot.sendMessage(chatId, `Warning: Failed to notify user of approval. They may have blocked the bot.`);
    }
}

/**
 * Handler for the /reject command (admin-only)
 * Rejects a transaction submission
 */
export async function handleRejectCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    // Get the bot instance for this botId
    const botFactory = BotFactory.getInstance();
    const bot = botFactory.getBot(botId);
    if (!bot) {
        console.error(`Bot with ID ${botId} not found`);
        return;
    }
    
    // Check if user is admin
    if (!isAdmin(chatId, botId)) {
        await bot.sendMessage(chatId, '⛔ This command is for administrators only.');
        return;
    }
    
    // Extract transaction ID from command
    const match = text.match(/\/reject\s+(.+)/) || null;
    if (!match || !match[1]) {
        await bot.sendMessage(chatId, 'Please provide a transaction ID to reject. Example: /reject [transaction_id]');
        return;
    }
    
    const transactionId = match[1].trim();
    if (!transactionId) {
        await bot.sendMessage(chatId, 'Please provide a valid transaction ID.');
        return;
    }
    
    // Attempt to update the transaction status
    const updatedTransaction = await updateTransactionStatus(transactionId, botId, 'rejected', chatId);
    
    if (!updatedTransaction) {
        await bot.sendMessage(chatId, '❌ Transaction not found. Please check the ID and try again.');
        return;
    }
    
    // Notify admin of successful rejection
    await bot.sendMessage(chatId, `❌ Transaction \`${transactionId}\` has been rejected.`, { parse_mode: 'Markdown' });
    
    // Notify user that their transaction was rejected
    try {
        await bot.sendMessage(
            updatedTransaction.userId,
            `❌ *Transaction Rejected*\n\nYour transaction with ID \`${transactionId}\` was disapproved. Please verify the transaction ID and try again, or contact support using /support.`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error(`Failed to notify user ${updatedTransaction.userId}:`, error);
        await bot.sendMessage(chatId, `Warning: Failed to notify user of rejection. They may have blocked the bot.`);
    }
}

/**
 * Handler for the back_to_menu callback
 * Returns user to the main menu options
 */
export async function handleBackToMenuCallback(query: TelegramBot.CallbackQuery, _data: string, botId: string): Promise<void> {
    // Get the bot instance for this botId
    const botFactory = BotFactory.getInstance();
    const bot = botFactory.getBot(botId);
    if (!bot) {
        console.error(`Bot with ID ${botId} not found`);
        return;
    }
    if (!query.message) return;
    
    const chatId = query.message.chat.id;
    
    try {
        await bot.editMessageText(
            '🔎 What would you like to do?',
            {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💼 Connect Wallet', callback_data: JSON.stringify({ method: 'connect_wallet', data: '' }) }],
                        [{ text: '💰 Send Transaction', callback_data: JSON.stringify({ method: 'send_transaction', data: '' }) }],
                        [{ text: '❓ Info & Help', callback_data: JSON.stringify({ method: 'show_info', data: '' }) }]
                    ]
                }
            }
        );
    } catch (error) {
        console.error('Error displaying back to menu:', error);
        
        // If editing fails (e.g., message too old), send a new message instead
        try {
            await safeSendMessage(chatId, 
                '🔎 What would you like to do?',
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '💼 Connect Wallet', callback_data: JSON.stringify({ method: 'connect_wallet', data: '' }) }],
                            [{ text: '💰 Send Transaction', callback_data: JSON.stringify({ method: 'send_transaction', data: '' }) }],
                            [{ text: '❓ Info & Help', callback_data: JSON.stringify({ method: 'show_info', data: '' }) }]
                        ]
                    }
                }
            );
        } catch (sendError) {
            console.error('Failed to send fallback menu message:', sendError);
        }
    }
}

/**
 * Handler for the /withdraw command
 * Loads a custom defined URL for withdrawals
 */
export async function handleWithdrawCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    
    // Get the bot instance for this botId
    const botFactory = BotFactory.getInstance();
    const bot = botFactory.getBot(botId);
    if (!bot) {
        console.error(`Bot with ID ${botId} not found`);
        return;
    }
    
    // Get the withdraw URL for this bot, fallback to default if not specified
    const botConfig = botFactory.getBotConfig(botId);
    const withdrawUrl = botConfig?.withdrawUrl || process.env.WITHDRAW_URL || 'https://dlb-sukuk.22web.org/withdraw';
    
    await bot.sendMessage(
        chatId,
        '💰 *Withdraw Your Interest* 💰\n\nClick the button below to securely withdraw your earned interest through our website.',
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: '🔐 Secure Withdrawal Portal',
                        url: withdrawUrl
                    }]
                ]
            }
        }
    );
}

/**
 * Gets all users for a specific bot
 * @param botId The ID of the bot to get users for
 * @returns Array of user data
 */
export async function getAllUsers(botId: string) {
    // This function should be implemented in the storage module
    // For now, return a subset of all tracked users filtered by botId
    const allUsers = await getAllTrackedUsers();
    return allUsers.filter(user => user.botId === botId);
}

/**
 * Handler for the /users command (admin-only)
 * Shows all users who have interacted with the bot, including those who never connected a wallet
 */
export async function handleUsersCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    
    // Get the bot instance for this botId
    const botFactory = BotFactory.getInstance();
    const bot = botFactory.getBot(botId);
    if (!bot) {
        console.error(`Bot with ID ${botId} not found`);
        return;
    }
    
    // Track user interaction
    await trackUserInteraction(chatId, botId);
    
    // Check if the user is an admin
    if (!isAdmin(chatId, botId)) {
        // Silently ignore for non-admins
        return;
    }
    
    // Placeholder for full implementation
    await bot.sendMessage(chatId, '*Users information for multi-bot mode*\n\nThis feature is currently being updated to support multiple bots.', { parse_mode: 'Markdown' });
}
