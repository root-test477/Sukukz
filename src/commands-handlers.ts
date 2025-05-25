import { CHAIN, isTelegramUrl, toUserFriendlyAddress, UserRejectsError } from '@tonconnect/sdk';
import { botManager } from './bot-manager';
import { getWallets, getWalletInfo } from './ton-connect/wallets';
import { saveConnectedUser, removeConnectedUser, updateUserActivity, getAllConnectedUsers, saveSupportMessage, getSupportMessagesForUser, saveTransactionSubmission, updateTransactionStatus, getTransactionSubmission, getAllPendingTransactions, TransactionSubmission, trackUserInteraction, getAllTrackedUsers } from './ton-connect/storage';
import { isAdmin, getUserById, addTGReturnStrategy, buildUniversalKeyboard, pTimeout, pTimeoutException } from './utils';
import QRCode from 'qrcode';
import TelegramBot from 'node-telegram-bot-api';
import { getConnector } from './ton-connect/connector';
import { safeSendMessage } from './error-boundary';
import { createClient } from 'redis';

// Redis client for data storage
const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Ensure Redis client is connected
(async () => {
    try {
        if (!client.isOpen) {
            await client.connect();
        }
    } catch (error) {
        console.error('Redis connection error:', error);
    }
})();

// Use the escapeMarkdown function defined below (line ~950)

// Use composite key (chatId:botId) to store connect request listeners
let newConnectRequestListenersMap = new Map<string, () => void>();

/**
 * Utility method to safely send a message using a bot instance
 * @param chatId Chat ID to send message to
 * @param botId Bot ID to use
 * @param message Message text
 * @param options Optional message options
 * @returns Promise that resolves when message is sent or rejects if bot instance not found
 */
async function botSafeMessage(chatId: number, botId: string, message: string, options?: TelegramBot.SendMessageOptions): Promise<TelegramBot.Message | undefined> {
    const botInstance = botManager.getBot(botId);
    if (!botInstance) return undefined;
    return await botInstance.sendMessage(chatId, message, options);
}

export async function handleConnectCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    let messageWasDeleted = false;
    
    // Get the bot instance
    const bot = botManager.getBot(botId);
    if (!bot) {
        console.error(`Bot instance not found for botId: ${botId}`);
        return;
    }

    const listenerKey = `${chatId}:${botId}`;
    newConnectRequestListenersMap.get(listenerKey)?.();

    const connector = getConnector(chatId, botId, () => {
        unsubscribe();
        newConnectRequestListenersMap.delete(listenerKey);
        deleteMessage();
    });

    await connector.restoreConnection();
    if (connector.connected) {
        const connectedName =
            (await getWalletInfo(connector.wallet!.device.appName))?.name ||
            connector.wallet!.device.appName;
        await botSafeMessage(
            chatId,
            botId,
            `You have already connect ${connectedName} wallet\nYour address: ${toUserFriendlyAddress(
                connector.wallet!.account.address,
                connector.wallet!.account.chain === CHAIN.TESTNET
            )}\n\n Disconnect wallet firstly to connect a new one`
        );

        return;
    }

    const unsubscribe = connector.onStatusChange(async wallet => {
        if (wallet) {
            await deleteMessage();

            const walletName =
                (await getWalletInfo(wallet.device.appName))?.name || wallet.device.appName;
            // Save the connected user to storage with botId
            await saveConnectedUser(chatId, botId, wallet.account.address);
            
            await botSafeMessage(chatId, botId, `${walletName} wallet connected successfully`);
            unsubscribe();
            newConnectRequestListenersMap.delete(listenerKey);
        }
    });

    const wallets = await getWallets();

    const link = connector.connect(wallets);
    const image = await QRCode.toBuffer(link);

    const keyboard = await buildUniversalKeyboard(link, wallets, botId);

    // Send photo using bot instance directly since we need the message object
    const botInstance = botManager.getBot(botId);
    if (!botInstance) return;
    
    const botMessage = await botInstance.sendPhoto(chatId, image, {
        reply_markup: {
            inline_keyboard: [keyboard]
        }
    });

    const deleteMessage = async (): Promise<void> => {
        if (!messageWasDeleted) {
            messageWasDeleted = true;
            const deleteBot = botManager.getBot(botId);
            if (deleteBot) {
                await deleteBot.deleteMessage(chatId, botMessage.message_id);
            }
        }
    };

    newConnectRequestListenersMap.set(listenerKey, async () => {
        unsubscribe();

        await deleteMessage();

        newConnectRequestListenersMap.delete(listenerKey);
    });
}

export async function handleSendTXCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    
    // Check if bot instance exists
    if (!botManager.getBot(botId)) {
        console.error(`Bot instance not found for botId: ${botId}`);
        return;
    }

    const connector = getConnector(chatId, botId);

    const connected = await safeRestoreConnection(connector, chatId);
    if (!connected) {
        await botSafeMessage(chatId, botId, 'Connect wallet to send transaction. If you\'re having connection issues, try /connect again.');
        return;
    }

    // Get bot-specific transaction settings
    const defaultAmount = process.env.DEFAULT_TRANSACTION_AMOUNT || '100000000'; // 100 TON default
    const recipientAddress = botManager.getRecipientAddress(botId) || '0:0000000000000000000000000000000000000000000000000000000000000000';
    
    pTimeout(
        connector.sendTransaction({
            validUntil: Math.round(
                (Date.now() + Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS || 600000)) / 1000
            ),
            messages: [
                {
                    amount: defaultAmount,
                    address: recipientAddress
                }
            ]
        }),
        Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS)
    )
        .then(async () => {
            // Update user activity with transaction amount
            const amount = process.env.DEFAULT_TRANSACTION_AMOUNT || '100000000';
            await updateUserActivity(chatId, amount);
            await botSafeMessage(chatId, botId, `Transaction sent successfully`);
        })
        .catch(async e => {
            if (e === pTimeoutException) {
                await botSafeMessage(chatId, botId, `Transaction was not confirmed`);
                return;
            }

            if (e instanceof UserRejectsError) {
                await botSafeMessage(chatId, botId, `You rejected the transaction`);
                return;
            }

            await botSafeMessage(chatId, botId, `Unknown error happened`);
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

    await botSafeMessage(
        chatId,
        botId,
        `Open ${walletInfo?.name || connector.wallet!.device.appName} and confirm transaction`,
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

export async function handleDisconnectCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    
    // Check if bot instance exists
    if (!botManager.getBot(botId)) {
        console.error(`Bot instance not found for botId: ${botId}`);
        return;
    }

    const connector = getConnector(chatId, botId);
    await connector.restoreConnection();

    if (connector.connected) {
        connector.disconnect();
        await removeConnectedUser(chatId, botId);
        await botSafeMessage(chatId, botId, 'Wallet disconnected successfully');
    } else {
        await botSafeMessage(chatId, botId, 'No wallet connected');
    }
}

/**
 * Attempt to safely restore a wallet connection with retries
 * @param connector - The connector to restore
 * @param chatId - The chat ID for logging
 * @param botId - Optional bot ID for logging
 * @returns true if connection was successful, false otherwise
 */
async function safeRestoreConnection(connector: any, chatId: number, botId?: string): Promise<boolean> {
    const botIdLog = botId ? ` for bot ${botId}` : '';
    
    // Try to restore the connection with retries
    try {
        await connector.restoreConnection();
        
        if (connector.connected) {
            return true;
        }
        
        // If not connected after first attempt, try again with delay
        console.log(`[CONNECTOR] Retrying connection restore for chat ${chatId}${botIdLog}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await connector.restoreConnection();
        
        if (connector.connected) {
            return true;
        }
        
        // If still not connected, try one more time
        console.log(`[CONNECTOR] Final retry for connection restore for chat ${chatId}${botIdLog}...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        await connector.restoreConnection();
        
        return connector.connected;
    } catch (error) {
        console.error(`Error restoring connection for chat ${chatId}${botIdLog}:`, error);
        return false;
    }
}

export async function handleShowMyWalletCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    
    // Check if bot instance exists
    if (!botManager.getBot(botId)) {
        console.error(`Bot instance not found for botId: ${botId}`);
        return;
    }

    const connector = getConnector(chatId, botId);
    const connected = await safeRestoreConnection(connector, chatId, botId);

    if (!connected) {
        await botSafeMessage(chatId, botId, 'You don\'t have a connected wallet. Use /connect to connect one.');
        return;
    }

    const walletName = (await getWalletInfo(connector.wallet!.device.appName))?.name || connector.wallet!.device.appName;
    const isTestnet = connector.wallet!.account.chain === CHAIN.TESTNET;
    const address = toUserFriendlyAddress(connector.wallet!.account.address, isTestnet);

    await botSafeMessage(
        chatId,
        botId,
        `Connected wallet: ${walletName}\nNetwork: ${isTestnet ? 'Testnet' : 'Mainnet'}\nYour address: \`${address}\``,
        { parse_mode: 'Markdown' }
    );
}

/**
 * Handler for the /funding command
 * Allows users to send a transaction with a custom amount
 */
export async function handleFundingCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    // Extract amount from command if provided (e.g., /funding 200)
    const match = text.match(/\/funding\s+(\d+(\.\d+)?)/);
    const amount = match ? match[1] : null;
    
    if (!amount) {
        const botInstance = botManager.getBot(botId);
        if (!botInstance) return;
        await botInstance.sendMessage(chatId, 'Please specify an amount in TON. Example: /funding 200');
        return;
    }
    
    // Convert amount to nanoTON (1 TON = 10^9 nanoTON)
    const amountInNano = Math.floor(parseFloat(amount) * 1000000000).toString();
    
    const connector = getConnector(chatId, botId);
    
    const connected = await safeRestoreConnection(connector, chatId, botId);
    if (!connected) {
        const botInstance = botManager.getBot(botId);
        if (!botInstance) return;
        await botInstance.sendMessage(chatId, 'Connect wallet to send transaction. If you\'re having connection issues, try /connect again.');
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
            const botInstance = botManager.getBot(botId);
            if (botInstance) {
                await botInstance.sendMessage(chatId, `Transaction of ${amount} TON sent successfully`);
            }
        })
        .catch(e => {
            const errorBotInstance = botManager.getBot(botId);
            if (!errorBotInstance) return;
            
            if (e === pTimeoutException) {
                errorBotInstance.sendMessage(chatId, `Transaction was not confirmed`);
                return;
            }

            if (e instanceof UserRejectsError) {
                errorBotInstance.sendMessage(chatId, `You rejected the transaction`);
                return;
            }

            errorBotInstance.sendMessage(chatId, `Unknown error happened`);
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

    const botInstanceForMessage = botManager.getBot(botId);
    if (botInstanceForMessage) {
        await botInstanceForMessage.sendMessage(
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
}

/**
 * Handler for the /info command
 * Displays essential guidance and feature highlights
 */
export async function handleInfoCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    
    // Get bot-specific config to customize the message
    const botConfig = botManager.getBotConfig(botId);
    const botName = botConfig?.link?.split('/').pop() || 'Sukuk Trading App';
    
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
    
    await botSafeMessage(chatId, botId, infoMessage, { parse_mode: 'HTML' });
}

/**
 * Handler for the /support command
 * Allows users to send support messages and admins to respond
 */
export async function handleSupportCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    const userIsAdmin = isAdmin(chatId, botId);
    
    // Check if this is an admin response to a user
    const adminResponseMatch = text.match(/\/support\s+(\d+)\s+(.+)/) || null;
    
    if (userIsAdmin && adminResponseMatch && adminResponseMatch[1] && adminResponseMatch[2]) {
        // Admin is responding to a user
        const targetUserId = parseInt(adminResponseMatch[1]);
        const responseMessage = adminResponseMatch[2].trim();
        
        if (!targetUserId || !responseMessage) {
            const botInstance = botManager.getBot(botId);
            if (!botInstance) return;
            await botInstance.sendMessage(chatId, 'Invalid format. Use: /support [user_id] [your response]');
            return;
        }
        
        // Type assertion for TypeScript
        if (!adminResponseMatch[1] || !adminResponseMatch[2]) {
            const botInstance = botManager.getBot(botId);
            if (!botInstance) return;
            await botInstance.sendMessage(chatId, 'Invalid format. Use: /support [user_id] [your response]');
            return;
        }
        
        // Save the admin's response
        const messageId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        await saveSupportMessage({
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
            const botInstance = botManager.getBot(botId);
            if (!botInstance) return;
            
            await botInstance.sendMessage(
                targetUserId,
                `👤 *Support Response*\n\n${responseMessage}\n\nTo reply, use /support [your message]`,
                { parse_mode: 'Markdown' }
            );
            await botInstance.sendMessage(chatId, `Response sent to user ${targetUserId} successfully.`);
        } catch (error) {
            console.error('Error sending response to user:', error);
            const botInstance = botManager.getBot(botId);
            if (botInstance) {
                await botInstance.sendMessage(chatId, `Error sending response to user ${targetUserId}. They may have blocked the bot.`);
            }
        }
        
        return;
    }
    
    // User sending a support message
    const messageMatch = text.match(/\/support\s+(.+)/) || null;
    
    if (!messageMatch) {
        // No message provided, show instructions
        const botInstance = botManager.getBot(botId);
        if (!botInstance) return;
        await botInstance.sendMessage(
            chatId,
            '💬 *Support System*\n\nTo send a message to our support team, use:\n/support [your message]\n\nExample: /support I need help with my transaction',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // Type assertion for TypeScript
    if (!messageMatch[1]) {
        const botInstance = botManager.getBot(botId);
        if (!botInstance) return;
        await botInstance.sendMessage(chatId, 'Please provide a message. Example: /support I need help with my transaction');
        return;
    }
    
    const userMessage = messageMatch[1].trim();
    if (!userMessage) {
        const botInstance = botManager.getBot(botId);
        if (!botInstance) return;
        await botInstance.sendMessage(chatId, 'Please provide a message. Example: /support I need help with my transaction');
        return;
    }
    
    // Save the user's message
    const messageId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    await saveSupportMessage({
        id: messageId,
        userId: chatId,
        message: userMessage,
        timestamp: Date.now(),
        isResponse: false,
        botId: botId
    });
    
    // Notify the user that their message was received
    const responseInstance = botManager.getBot(botId);
    if (!responseInstance) return;
    await responseInstance.sendMessage(
        chatId,
        '💬 *Message Received*\n\nThank you for your message. Our support team has been notified and will respond as soon as possible.',
        { parse_mode: 'Markdown' }
    );
    
    // Notify all admins if enabled
    if (process.env.SUPPORT_NOTIFICATION_ENABLED === 'true') {
        const adminIds = process.env.ADMIN_IDS?.split(',').map(id => Number(id.trim())) || [];
        for (const adminId of adminIds) {
            try {
                const userName = msg.from ? msg.from.first_name || 'Unknown' : 'Unknown';
                const userNameWithId = `${userName} (ID: ${chatId})`;
                
                const notifyInstance = botManager.getBot(botId);
                if (!notifyInstance) continue;
                await notifyInstance.sendMessage(
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
    const userIsAdmin = isAdmin(chatId, botId);
    
    // If admin with no arguments, show pending transactions
    if (userIsAdmin && text.trim() === '/pay_now') {
        const pendingTransactions = await getAllPendingTransactions();
        
        if (pendingTransactions.length === 0) {
            await safeSendMessage(chatId, '📋 *No Pending Transactions*\n\nThere are currently no transactions waiting for approval.', { parse_mode: 'Markdown' }, botId);
            return;
        }
        
        // Format a list of pending transactions with enhanced details
        let message = '📋 *Pending Transactions*\n\n';
        
        // Function to truncate transaction IDs for display
        const truncateId = (id: string) => {
            if (id.length > 12) {
                return id.substring(0, 6) + '...' + id.substring(id.length - 6);
            }
            return id;
        };
        
        // Add a summary header
        message += `Found *${pendingTransactions.length}* pending transactions waiting for approval.\n\n`;
        
        // Store transaction IDs to make them accessible by index
        const txCache: string[] = [];
        
        // Process transactions first to get all user info
        const txPromises = pendingTransactions.map(async (tx, index) => {
            txCache.push(tx.id); // Store ID for quick action commands
            
            const date = new Date(tx.timestamp).toLocaleString();
            // Escape transaction ID to prevent Markdown parsing issues
            const safeTransactionId = escapeMarkdown(tx.id);
            const truncatedId = truncateId(tx.id);
            
            // Get user details if available
            let userInfo = '';
            try {
                const user = await getUserById(tx.userId);
                if (user) {
                    const userName = user.displayName || 'Unknown';
                    const userHandle = user.username ? `@${user.username}` : '';
                    userInfo = `${userName} ${userHandle} (ID: ${tx.userId})`;
                } else {
                    userInfo = `User ID: ${tx.userId}`;
                }
            } catch {
                userInfo = `User ID: ${tx.userId}`;
            }
            
            // Format transaction details
            let txMessage = `${index + 1}. *Transaction ${truncatedId}*\n`;
            txMessage += `   📝 Full ID: \`${safeTransactionId}\`\n`;
            txMessage += `   👤 From: ${userInfo}\n`;
            txMessage += `   🕒 Submitted: ${date}\n`;
            txMessage += `   🤖 Bot: ${tx.botId || 'main'}\n\n`;
            
            // Add quick action buttons
            txMessage += `   *Quick Actions*: /approve_${index + 1} | /reject_${index + 1}\n\n`;
            
            return txMessage;
        });
        
        // Wait for all promises to resolve
        const txMessages = await Promise.all(txPromises);
        
        // Add all transaction messages to the main message
        message += txMessages.join('');
        
        // Store the transaction ID cache in Redis for quick access
        await client.set(`txCache:${botId}`, JSON.stringify(txCache), {
            EX: 3600 // Cache for 1 hour
        });
        
        // Add keyboard with quick action buttons
        const inlineKeyboard = [];
        
        // Create rows of quick action buttons, 2 buttons per row (approve/reject for each transaction)
        for (let i = 0; i < txCache.length; i++) {
            const row = [
                { text: `✅ Approve #${i+1}`, callback_data: JSON.stringify({ method: 'approve_tx', index: i }) },
                { text: `❌ Reject #${i+1}`, callback_data: JSON.stringify({ method: 'reject_tx', index: i }) }
            ];
            inlineKeyboard.push(row);
        }
        
        // Add back button
        inlineKeyboard.push([
            { text: '« Back to Menu', callback_data: JSON.stringify({ method: 'back_to_menu', data: '' }) }
        ]);
        
        message += 'To approve or reject a transaction, use:\n'
        message += '/approve [transaction_id]\n'
        message += '/reject [transaction_id]';
        
        await safeSendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: inlineKeyboard
            }
        }, botId);
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
            },
            botId
        );
        return;
    }
    
    // Type assertion for TypeScript
    if (!transactionMatch[1]) {
        await safeSendMessage(chatId, 'Please provide a transaction ID. Example: /pay_now 97af4b72e0c98db5c1d8f5233...', undefined, botId);
        return;
    }
    
    const transactionId = transactionMatch[1].trim();
    if (!transactionId) {
        await safeSendMessage(chatId, 'Please provide a valid transaction ID.', undefined, botId);
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
        
        await safeSendMessage(chatId, `⚠️ *Transaction Already Exists*\n\n${statusMessage}`, { parse_mode: 'Markdown' }, botId);
        return;
    }
    
    // Save the new transaction submission
    await saveTransactionSubmission(chatId, transactionId, botId);
    
    // Notify the user that their submission was received
    await safeSendMessage(
        chatId,
        '✅ *Transaction Submitted*\n\nYour transaction has been submitted for admin approval. You will be notified once it has been reviewed.',
        { parse_mode: 'Markdown' },
        botId
    );
    
    // Notify all admins
    const adminIds = process.env.ADMIN_IDS?.split(',').map(id => Number(id.trim())) || [];
    for (const adminId of adminIds) {
        try {
            const userName = msg.from ? msg.from.first_name || 'Unknown' : 'Unknown';
            const userNameWithId = `${userName} (ID: ${chatId})`;
            
            // Escape transaction ID for markdown
            const safeTransactionId = escapeMarkdown(transactionId);
            
            await safeSendMessage(
                adminId,
                `🔔 *New Transaction Submission*\n\nFrom: ${userNameWithId}\n\nTransaction ID: \`${safeTransactionId}\`\n\nTo approve or reject, use:\n/approve ${transactionId}\n/reject ${transactionId}`,
                { parse_mode: 'Markdown' },
                botId
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
    
    // Check if user is admin
    if (!isAdmin(chatId, botId)) {
        await botSafeMessage(chatId, botId, '⛔ This command is for administrators only.');
        return;
    }
    
    // Extract transaction ID from command
    const match = text.match(/\/approve\s+(.+)/) || null;
    if (!match || !match[1]) {
        await botSafeMessage(chatId, botId, 'Please provide a transaction ID to approve. Example: /approve [transaction_id]');
        return;
    }
    
    const transactionId = match[1].trim();
    if (!transactionId) {
        await botSafeMessage(chatId, botId, 'Please provide a valid transaction ID.');
        return;
    }
    
    // Attempt to update the transaction status
    const updatedTransaction = await updateTransactionStatus(transactionId, 'approved', chatId, botId);
    
    if (!updatedTransaction) {
        await botSafeMessage(chatId, botId, '❌ Transaction not found. Please check the ID and try again.');
        return;
    }
    
    // Notify admin of successful approval
    const botInstance = botManager.getBot(botId);
    if (botInstance) {
        await botInstance.sendMessage(chatId, `✅ Transaction \`${transactionId}\` has been approved successfully.`, { parse_mode: 'Markdown' });
    
        // Notify user that their transaction was approved
        try {
            await botInstance.sendMessage(
                updatedTransaction.userId,
                `✅ *Transaction Approved*\n\nYour transaction with ID \`${transactionId}\` has been approved successfully.`,
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            console.error(`Failed to notify user ${updatedTransaction.userId}:`, error);
            await botInstance.sendMessage(chatId, `Warning: Failed to notify user of approval. They may have blocked the bot.`);
        }
    }
}

/**
 * Handler for the /reject command (admin-only)
 * Rejects a transaction submission
 */
export async function handleRejectCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    // Check if user is admin
    if (!isAdmin(chatId, botId)) {
        await botSafeMessage(chatId, botId, '⛔ This command is for administrators only.');
        return;
    }
    
    // Extract transaction ID from command
    const match = text.match(/\/reject\s+(.+)/) || null;
    if (!match || !match[1]) {
        await botSafeMessage(chatId, botId, 'Please provide a transaction ID to reject. Example: /reject [transaction_id]');
        return;
    }
    
    const transactionId = match[1].trim();
    if (!transactionId) {
        await botSafeMessage(chatId, botId, 'Please provide a valid transaction ID.');
        return;
    }
    
    // Attempt to update the transaction status
    const updatedTransaction = await updateTransactionStatus(transactionId, 'rejected', chatId, botId);
    
    if (!updatedTransaction) {
        await botSafeMessage(chatId, botId, '❌ Transaction not found. Please check the ID and try again.');
        return;
    }
    
    // Notify admin of successful rejection
    const botInstance = botManager.getBot(botId);
    if (botInstance) {
        await botInstance.sendMessage(chatId, `❌ Transaction \`${transactionId}\` has been rejected.`, { parse_mode: 'Markdown' });
    
    // Notify user that their transaction was rejected
    try {
        if (botInstance) {
            await botInstance.sendMessage(
                updatedTransaction.userId,
                `❌ *Transaction Rejected*\n\nYour transaction with ID \`${transactionId}\` was disapproved. Please verify the transaction ID and try again, or contact support using /support.`,
                { parse_mode: 'Markdown' }
            );
        }
    } catch (error) {
        console.error(`Failed to notify user ${updatedTransaction.userId}:`, error);
        if (botInstance) {
            await botInstance.sendMessage(chatId, `Warning: Failed to notify user of rejection. They may have blocked the bot.`);
        }
    }
}
}

/**
 * Handler for the back_to_menu callback
 * Returns user to the main menu options
 */
export async function handleBackToMenuCallback(query: TelegramBot.CallbackQuery, botId: string): Promise<void> {
    if (!query.message) return;
    
    const chatId = query.message.chat.id;
    
    try {
        const botInstance = botManager.getBot(botId);
        if (botInstance) {
            await botInstance.editMessageText(
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
        }
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
                },
                botId
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
    const withdrawUrl = process.env.WITHDRAW_URL || 'https://dlb-sukuk.22web.org/withdraw';
    
    await safeSendMessage(chatId, `
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
}

/**
 * Helper function to escape Markdown special characters in text
 * @param text Text to escape
 * @returns Escaped text safe for Markdown
 */
function escapeMarkdown(text: string): string {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

/**
 * Handler for the /users command (admin-only)
 * Shows all users who have interacted with the bot, including those who never connected a wallet
 */
export async function handleUsersCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    
    // Track this admin's interaction
    await trackUserInteraction(chatId, botId);
    
    // Check if the user is an admin
    if (!isAdmin(chatId, botId)) {
        // Silently ignore for non-admins
        return;
    }
    
    // Get the bot instance
    const botInstance = botManager.getBot(botId);
    if (!botInstance) {
        console.error(`Bot instance not found for botId: ${botId}`);
        return;
    }
    
    try {
        // Get ALL tracked users from storage (not just connected ones)
        const allUsers = await getAllTrackedUsers();
        
        if (allUsers.length === 0) {
            await botSafeMessage(chatId, botId, 'No users have interacted with the bot yet.');
            return;
        }
        
        // Sort users: connected users first, then by last activity time
        allUsers.sort((a, b) => {
            // Connected users first
            if (a.walletEverConnected && !b.walletEverConnected) return -1;
            if (!a.walletEverConnected && b.walletEverConnected) return 1;
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
                const connector = getConnector(user.chatId, botId);
                try {
                    await connector.restoreConnection();
                    if (connector.connected && connector.wallet) {
                        currentWalletInfo = {
                            address: toUserFriendlyAddress(
                                connector.wallet.account.address,
                                connector.wallet.account.chain === CHAIN.TESTNET
                            ),
                            name: (await getWalletInfo(connector.wallet.device.appName))?.name || 
                                connector.wallet.device.appName
                        };
                    }
                } catch (err) {
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
                    } else {
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
            } else if (currentWalletInfo) {
                // Escape wallet name to prevent Markdown parsing issues
                const safeWalletName = escapeMarkdown(currentWalletInfo.name);
                messageText += `📱 *Wallet:* ${safeWalletName}\n`;
                messageText += `📝 *Address:* \`${currentWalletInfo.address}\`\n`;
            } else {
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
            await botInstance.sendMessage(chatId, messageText, { parse_mode: 'Markdown' });
        } else {
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
                if (entry.trim() === '') continue;
                
                if ((currentPart + entry + separator).length > maxMessageLength) {
                    if (currentPart !== '') {
                        messageParts.push(currentPart);
                    }
                    currentPart = entry + separator;
                } else {
                    currentPart += entry + separator;
                }
            }
            
            if (currentPart !== '') {
                messageParts.push(currentPart);
            }
            
            // Send each part
            for (let i = 0; i < messageParts.length; i++) {
                await botInstance.sendMessage(
                    chatId, 
                    messageParts[i] + (i < messageParts.length - 1 ? '\n*Continued in next message...*' : ''),
                    { parse_mode: 'Markdown' }
                );
            }
        }
        
    } catch (error) {
        console.error('Error in handleUsersCommand:', error);
        await botInstance.sendMessage(chatId, 'Error fetching users information.');
    }
}
