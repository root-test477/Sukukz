import { CHAIN, isTelegramUrl, toUserFriendlyAddress, UserRejectsError } from '@tonconnect/sdk';
import { bot } from './bot';
import { getWallets, getWalletInfo } from './ton-connect/wallets';
import { saveConnectedUser, removeConnectedUser, updateUserActivity, getAllConnectedUsers, saveSupportMessage, getSupportMessagesForUser, saveTransactionSubmission, updateTransactionStatus, getTransactionSubmission, getAllPendingTransactions, TransactionSubmission, trackUserInteraction, getAllTrackedUsers } from './ton-connect/storage';
import { isAdmin } from './utils';
import QRCode from 'qrcode';
import TelegramBot from 'node-telegram-bot-api';
import { getConnector } from './ton-connect/connector';
import { addTGReturnStrategy, buildUniversalKeyboard, pTimeout, pTimeoutException } from './utils';
import { advanceTutorialIfNeeded } from './tutorial';
import { 
    saveScheduledMessage, 
    getScheduledMessage, 
    getAllScheduledMessages, 
    getPendingScheduledMessages,
    updateScheduledMessage,
    deleteScheduledMessage,
    ScheduledMessage
} from './ton-connect/storage';

let newConnectRequestListenersMap = new Map<number, () => void>();

export async function handleConnectCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    let messageWasDeleted = false;

    newConnectRequestListenersMap.get(chatId)?.();

    const connector = getConnector(chatId, () => {
        unsubscribe();
        newConnectRequestListenersMap.delete(chatId);
        deleteMessage();
    });

    await connector.restoreConnection();
    if (connector.connected) {
        const connectedName =
            (await getWalletInfo(connector.wallet!.device.appName))?.name ||
            connector.wallet!.device.appName;
        await bot.sendMessage(
            chatId,
            `You have already connect ${connectedName} wallet\nYour address: ${toUserFriendlyAddress(
                connector.wallet!.account.address,
                connector.wallet!.account.chain === CHAIN.TESTNET
            )}\n\n Disconnect wallet firstly to connect a new one`
        );

        // Still advance tutorial if in connect wallet stage
        await advanceTutorialIfNeeded(chatId, 'connect');
        return;
    }

    const unsubscribe = connector.onStatusChange(async wallet => {
        if (wallet) {
            await deleteMessage();

            const walletName =
                (await getWalletInfo(wallet.device.appName))?.name || wallet.device.appName;
            // Save the connected user to storage
            await saveConnectedUser(chatId, wallet.account.address);
            
            await bot.sendMessage(chatId, `${walletName} wallet connected successfully`);
            
            // Advance tutorial if in connect wallet stage
            await advanceTutorialIfNeeded(chatId, 'connect');
            
            unsubscribe();
            newConnectRequestListenersMap.delete(chatId);
        }
    });

    const wallets = await getWallets();

    const link = connector.connect(wallets);
    const image = await QRCode.toBuffer(link);

    const keyboard = await buildUniversalKeyboard(link, wallets);

    const botMessage = await bot.sendPhoto(chatId, image, {
        reply_markup: {
            inline_keyboard: [keyboard]
        }
    });

    const deleteMessage = async (): Promise<void> => {
        if (!messageWasDeleted) {
            messageWasDeleted = true;
            await bot.deleteMessage(chatId, botMessage.message_id);
        }
    };

    newConnectRequestListenersMap.set(chatId, async () => {
        unsubscribe();

        await deleteMessage();

        newConnectRequestListenersMap.delete(chatId);
    });
}

export async function handleSendTXCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    const connector = getConnector(chatId);

    const connected = await safeRestoreConnection(connector, chatId);
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
                    amount: process.env.DEFAULT_TRANSACTION_AMOUNT || '100000000', // 100 TON default
                    address: process.env.DEFAULT_RECIPIENT_ADDRESS || '0:0000000000000000000000000000000000000000000000000000000000000000'
                }
            ]
        }),
        Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS)
    )
        .then(async () => {
            // Update user activity with transaction amount
            const amount = process.env.DEFAULT_TRANSACTION_AMOUNT || '100000000';
            await updateUserActivity(chatId, amount);
            bot.sendMessage(chatId, `Transaction sent successfully`);
            
            // Advance tutorial if in send transaction stage
            await advanceTutorialIfNeeded(chatId, 'send_tx');
        })
        .catch(e => {
            if (e === pTimeoutException) {
                bot.sendMessage(chatId, `Transaction was not confirmed`);
                return;
            }

            if (e instanceof UserRejectsError) {
                bot.sendMessage(chatId, `You rejected the transaction`);
                return;
            }

            bot.sendMessage(chatId, `Unknown error happened`);
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

export async function handleDisconnectCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    const connector = getConnector(chatId);

    await connector.restoreConnection();
    if (!connector.connected) {
        await bot.sendMessage(chatId, "You didn't connect a wallet");
        return;
    }

    await connector.disconnect();
    
    // Remove user from tracking when they disconnect
    await removeConnectedUser(chatId);

    await bot.sendMessage(chatId, 'Wallet has been disconnected');
}

/**
 * Attempt to safely restore a wallet connection with retries
 * @param connector - The connector to restore
 * @param chatId - The chat ID for logging
 * @returns true if connection was successful, false otherwise
 */
async function safeRestoreConnection(connector: any, chatId: number): Promise<boolean> {
    try {
        // Make multiple attempts to restore the connection
        for (let attempt = 1; attempt <= 3; attempt++) {
            console.log(`[WALLET] Attempt ${attempt} to restore connection for chat ${chatId}`);
            try {
                await connector.restoreConnection();
                if (connector.connected) {
                    console.log(`[WALLET] Successfully connected on attempt ${attempt} for chat ${chatId}`);
                    return true;
                }
            } catch (error) {
                console.log(`[WALLET] Error on attempt ${attempt}:`, error);
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }
        
        console.log(`[WALLET] All connection attempts failed for chat ${chatId}`);
        return false;
    } catch (error) {
        console.log(`[WALLET] Unexpected error during connection attempts:`, error);
        return false;
    }
}

export async function handleShowMyWalletCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    const connector = getConnector(chatId);

    // Use our enhanced connection method
    const connected = await safeRestoreConnection(connector, chatId);
    if (!connected) {
        await bot.sendMessage(chatId, "You didn't connect a wallet or connection failed. Try using /connect again");
        return;
    }

    const walletName =
        (await getWalletInfo(connector.wallet!.device.appName))?.name ||
        connector.wallet!.device.appName;

    await bot.sendMessage(
        chatId,
        `Connected wallet: ${walletName}\nYour address: ${toUserFriendlyAddress(
            connector.wallet!.account.address,
            connector.wallet!.account.chain === CHAIN.TESTNET
        )}`
    );
    
    // Advance tutorial if in check wallet stage
    await advanceTutorialIfNeeded(chatId, 'check_wallet');
}

/**
 * Handler for the /funding command
 * Allows users to send a transaction with a custom amount
 */
export async function handleFundingCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    // Extract amount from command if provided (e.g., /funding 200)
    const match = text.match(/\/funding\s+(\d+(\.\d+)?)/);
    const amount = match ? match[1] : null;
    
    if (!amount) {
        await bot.sendMessage(chatId, 'Please specify an amount in TON. Example: /funding 200');
        return;
    }
    
    // Convert amount to nanoTON (1 TON = 10^9 nanoTON)
    const amountInNano = Math.floor(parseFloat(amount) * 1000000000).toString();
    
    const connector = getConnector(chatId);
    
    const connected = await safeRestoreConnection(connector, chatId);
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
            await updateUserActivity(chatId, amountInNano);
            bot.sendMessage(chatId, `Transaction of ${amount} TON sent successfully`);
            
            // Advance tutorial if in send transaction stage
            await advanceTutorialIfNeeded(chatId, 'send_tx');
        })
        .catch(e => {
            if (e === pTimeoutException) {
                bot.sendMessage(chatId, `Transaction was not confirmed`);
                return;
            }

            if (e instanceof UserRejectsError) {
                bot.sendMessage(chatId, `You rejected the transaction`);
                return;
            }

            bot.sendMessage(chatId, `Unknown error happened`);
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
export async function handleInfoCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    
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
}

/**
 * Handler for the /support command
 * Allows users to send support messages and admins to respond
 */
export async function handleSupportCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    const userIsAdmin = isAdmin(chatId);
    
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
        
        // Type assertion for TypeScript
        if (!adminResponseMatch[1] || !adminResponseMatch[2]) {
            await bot.sendMessage(chatId, 'Invalid format. Use: /support [user_id] [your response]');
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
    
    // Type assertion for TypeScript
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
        const adminIds = process.env.ADMIN_IDS?.split(',').map(id => Number(id.trim())) || [];
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
export async function handlePayNowCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    const userIsAdmin = isAdmin(chatId);
    
    // If admin with no arguments, show pending transactions
    if (userIsAdmin && text.trim() === '/pay_now') {
        const pendingTransactions = await getAllPendingTransactions();
        
        if (pendingTransactions.length === 0) {
            await bot.sendMessage(chatId, '📋 *No Pending Transactions*\n\nThere are currently no transactions waiting for approval.', { parse_mode: 'Markdown' });
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
        
        message += 'To approve or reject a transaction, use:\n'
        message += '/approve [transaction_id]\n'
        message += '/reject [transaction_id]';
        
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        return;
    }
    
    // User submitting a new transaction
    const transactionMatch = text.match(/\/pay_now\s+(.+)/) || null;
    
    if (!transactionMatch) {
        // No transaction ID provided, show instructions
        await bot.sendMessage(
            chatId,
            '💸 *Transaction Submission*\n\nTo submit a transaction for approval, use:\n/pay_now [transaction_id]\n\nExample: /pay_now 97af4b72e0c98db5c1d8f5233...',
            { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '« Back to Menu', callback_data: 'back_to_menu' }
                    ]]
                }
            }
        );
        return;
    }
    
    // Type assertion for TypeScript
    if (!transactionMatch[1]) {
        await bot.sendMessage(chatId, 'Please provide a transaction ID. Example: /pay_now 97af4b72e0c98db5c1d8f5233...');
        return;
    }
    
    const transactionId = transactionMatch[1].trim();
    if (!transactionId) {
        await bot.sendMessage(chatId, 'Please provide a valid transaction ID.');
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
        
        await bot.sendMessage(chatId, `⚠️ *Transaction Already Exists*\n\n${statusMessage}`, { parse_mode: 'Markdown' });
        return;
    }
    
    // Save the new transaction submission
    await saveTransactionSubmission(chatId, transactionId);
    
    // Notify the user that their submission was received
    await bot.sendMessage(
        chatId,
        '✅ *Transaction Submitted*\n\nYour transaction has been submitted for admin approval. You will be notified once it has been reviewed.',
        { parse_mode: 'Markdown' }
    );
    
    // Notify all admins
    const adminIds = process.env.ADMIN_IDS?.split(',').map(id => Number(id.trim())) || [];
    for (const adminId of adminIds) {
        try {
            const userName = msg.from ? msg.from.first_name || 'Unknown' : 'Unknown';
            const userNameWithId = `${userName} (ID: ${chatId})`;
            
            await bot.sendMessage(
                adminId,
                `🔔 *New Transaction Submission*\n\nFrom: ${userNameWithId}\n\nTransaction ID: \`${transactionId}\`\n\nTo approve or reject, use:\n/approve ${transactionId}\n/reject ${transactionId}`,
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
export async function handleApproveCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    // Check if user is admin
    if (!isAdmin(chatId)) {
        await bot.sendMessage(chatId, '⛔ This command is for administrators only.');
        return;
    }
    
    // Extract transaction ID from command
    const match = text.match(/\/approve\s+(.+)/) || null;
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
    const updatedTransaction = await updateTransactionStatus(transactionId, 'approved', chatId);
    
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
export async function handleRejectCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    // Check if user is admin
    if (!isAdmin(chatId)) {
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
    const updatedTransaction = await updateTransactionStatus(transactionId, 'rejected', chatId);
    
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
export async function handleBackToMenuCallback(query: TelegramBot.CallbackQuery): Promise<void> {
    if (!query.message) return;
    
    const chatId = query.message.chat.id;
    
    await bot.editMessageText(
        '🔍 What would you like to do?',
        {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💼 Connect Wallet', callback_data: 'connect_wallet' }],
                    [{ text: '💰 Send Transaction', callback_data: 'send_transaction' }],
                    [{ text: '❓ Info & Help', callback_data: 'show_info' }]
                ]
            }
        }
    );
}

/**
 * Handler for the /withdraw command
 * Loads a custom defined URL for withdrawals
 */
export async function handleWithdrawCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const withdrawUrl = process.env.WITHDRAW_URL || 'https://dlb-sukuk.22web.org/withdraw';
    
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
export async function handleUsersCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    
    // Track this admin's interaction
    await trackUserInteraction(chatId);
    
    // Check if the user is an admin
    if (!isAdmin(chatId)) {
        // Silently ignore for non-admins
        return;
    }
    
    try {
        // Get ALL tracked users from storage (not just connected ones)
        const allUsers = await getAllTrackedUsers();
        
        if (allUsers.length === 0) {
            await bot.sendMessage(chatId, 'No users have interacted with the bot yet.');
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
                const connector = getConnector(user.chatId);
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
            await bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown' });
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
                await bot.sendMessage(
                    chatId, 
                    messageParts[i] + (i < messageParts.length - 1 ? '\n*Continued in next message...*' : ''),
                    { parse_mode: 'Markdown' }
                );
            }
        }
        
    } catch (error) {
        console.error('Error in handleUsersCommand:', error);
        await bot.sendMessage(chatId, 'Error fetching users information.');
    }
}

/**
 * Handle /analytics command to show usage statistics (admin only)
 */
export async function handleAnalyticsCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    // Only admins can view analytics
    if (!isAdmin(chatId)) {
        await bot.sendMessage(chatId, 'This command is only available to administrators.');
        return;
    }

    try {
        // Get all users who have interacted with the bot
        const allUsers = await getAllTrackedUsers();
        
        // Get all connected wallet users
        const connectedUsers = await getAllConnectedUsers();
        
        // Get all pending transactions
        const pendingTxs = await getAllPendingTransactions();
        
        // Calculate active users in the last 24 hours
        const last24h = Date.now() - 24 * 60 * 60 * 1000;
        const activeUsers = allUsers.filter(user => user.lastActivity && user.lastActivity > last24h);
        
        // Create analytics report
        const report = `📊 *Analytics Report*\n\n` +
            `🔹 *User Stats*\n` +
            `• Total users: ${allUsers.length}\n` +
            `• Active users (24h): ${activeUsers.length}\n` +
            `• Connected wallets: ${connectedUsers.length}\n\n` +
            
            `🔹 *Transaction Stats*\n` +
            `• Pending transactions: ${pendingTxs.length}\n` +
            `• Total transaction volume: ${calculateTotalVolume(allUsers)} TON\n\n` +
            
            `🔹 *Wallet Distribution*\n` +
            formatWalletDistribution(connectedUsers);
        
        await bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error generating analytics report:', error);
        await bot.sendMessage(chatId, 'Error generating analytics report. Please try again later.');
    }
}

/**
 * Calculate total transaction volume from user activity
 */
function calculateTotalVolume(users: any[]): number {
    let totalVolume = 0;
    
    users.forEach(user => {
        if (user.transactions) {
            // Sum up all transaction amounts
            Object.values(user.transactions).forEach((tx: any) => {
                if (tx.amount) {
                    // Convert from nanoTON to TON
                    totalVolume += Number(tx.amount) / 1000000000;
                }
            });
        }
    });
    
    return Math.round(totalVolume * 100) / 100; // Round to 2 decimal places
}

/**
 * Format wallet distribution for analytics report
 */
function formatWalletDistribution(users: any[]): string {
    const wallets: Record<string, number> = {};
    
    // Count wallet types
    users.forEach(user => {
        if (user.wallet?.appName) {
            const appName = user.wallet.appName;
            wallets[appName] = (wallets[appName] || 0) + 1;
        }
    });
    
    // Sort by popularity
    const sortedWallets = Object.entries(wallets)
        .sort(([, countA], [, countB]) => countB - countA);
    
    // Format as bullet points
    if (sortedWallets.length === 0) {
        return '• No wallet data available';
    }
    
    return sortedWallets
        .map(([wallet, count]) => `• ${wallet}: ${count} users`)
        .join('\n');
}

/**
 * Handle /schedule command to create a scheduled message (admin only)
 * Format: /schedule <time> <target> <message>
 * Example: /schedule 2023-12-31T23:59 all Happy New Year to all users!
 */
export async function handleScheduleCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    // Only admins can schedule messages
    if (!isAdmin(chatId)) {
        await bot.sendMessage(chatId, 'This command is only available to administrators.');
        return;
    }

    const text = msg.text || '';
    const match = text.match(/\/schedule\s+([^\s]+)\s+([^\s]+)\s+(.*)/);
    
    if (!match || !match[1] || !match[2] || !match[3]) {
        await bot.sendMessage(
            chatId,
            'Please use the format: /schedule <time> <target> <message>\n\n' +
            'Examples:\n' +
            '• /schedule 2023-12-31T23:59 all Happy New Year!\n' +
            '• /schedule 1h connected Wallet maintenance in 1 hour\n' +
            '• /schedule 30m active Quick reminder about our new feature\n\n' +
            'Time formats:\n' +
            '• ISO date: 2023-12-31T23:59\n' +
            '• Relative: 30m (30 minutes), 2h (2 hours), 1d (1 day)'
        );
        return;
    }
    
    const timeStr = match[1];
    const targetStr = match[2];
    const messageContent = match[3];
    
    // Parse time
    let scheduledTime: number;
    if (timeStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
        // ISO format: 2023-12-31T23:59
        scheduledTime = new Date(timeStr).getTime();
    } else if (timeStr.match(/^(\d+)([mhd])$/)) {
        // Relative format: 30m, 2h, 1d
        const amountMatch = timeStr.match(/^(\d+)/);
        const unitMatch = timeStr.match(/([mhd])$/);
        
        if (!amountMatch || !amountMatch[1] || !unitMatch || !unitMatch[1]) {
            await bot.sendMessage(chatId, 'Invalid time format. Use ISO format (2023-12-31T23:59) or relative format (30m, 2h, 1d).');
            return;
        }
        
        const amount = parseInt(amountMatch[1]);
        const unit = unitMatch[1];
        
        const now = Date.now();
        switch (unit) {
            case 'm': scheduledTime = now + amount * 60 * 1000; break;
            case 'h': scheduledTime = now + amount * 60 * 60 * 1000; break;
            case 'd': scheduledTime = now + amount * 24 * 60 * 60 * 1000; break;
            default: scheduledTime = now; break;
        }
    } else {
        await bot.sendMessage(chatId, 'Invalid time format. Use ISO format (2023-12-31T23:59) or relative format (30m, 2h, 1d).');
        return;
    }
    
    // Validate time is in the future
    if (scheduledTime <= Date.now()) {
        await bot.sendMessage(chatId, 'Scheduled time must be in the future.');
        return;
    }
    
    // Parse target
    let target: 'all' | 'connected' | 'active' | number[];
    switch (targetStr.toLowerCase()) {
        case 'all':
            target = 'all';
            break;
        case 'connected':
            target = 'connected';
            break;
        case 'active':
            target = 'active';
            break;
        default:
            await bot.sendMessage(chatId, 'Invalid target. Use "all", "connected", or "active".');
            return;
    }
    
    // Create the scheduled message
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const scheduledMessage: ScheduledMessage = {
        id: messageId,
        message: messageContent,
        targetUsers: target,
        scheduledTime,
        createdBy: chatId,
        createdAt: Date.now(),
        sent: false
    };
    
    await saveScheduledMessage(scheduledMessage);
    
    // Format the date for display
    const dateStr = new Date(scheduledTime).toLocaleString();
    
    await bot.sendMessage(
        chatId,
        `✅ Message scheduled successfully!\n\n` +
        `🆔 ID: ${messageId}\n` +
        `📅 Scheduled for: ${dateStr}\n` +
        `👥 Target: ${target}\n` +
        `📝 Message: "${messageContent}"\n\n` +
        `To view all scheduled messages, use /scheduled\n` +
        `To cancel this message, use /cancel_schedule ${messageId}`
    );
}

/**
 * Handle /scheduled command to view all scheduled messages (admin only)
 */
export async function handleScheduledCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    // Only admins can view scheduled messages
    if (!isAdmin(chatId)) {
        await bot.sendMessage(chatId, 'This command is only available to administrators.');
        return;
    }
    
    const messages = await getAllScheduledMessages();
    
    if (messages.length === 0) {
        await bot.sendMessage(chatId, 'No scheduled messages found.');
        return;
    }
    
    // Sort by scheduledTime
    messages.sort((a, b) => a.scheduledTime - b.scheduledTime);
    
    let response = `📅 *Scheduled Messages (${messages.length})*\n\n`;
    
    for (const message of messages) {
        const dateStr = new Date(message.scheduledTime).toLocaleString();
        const status = message.sent ? '✅ Sent' : '⏳ Pending';
        
        response += `🆔 *${message.id}*\n` +
            `📅 Scheduled: ${dateStr}\n` +
            `👥 Target: ${message.targetUsers}\n` +
            `📝 Message: "${message.message.substring(0, 50)}${message.message.length > 50 ? '...' : ''}"\n` +
            `📊 Status: ${status}\n\n`;
    }
    
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
}

/**
 * Handle /cancel_schedule command to cancel a scheduled message (admin only)
 * Format: /cancel_schedule <id>
 */
export async function handleCancelScheduleCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    // Only admins can cancel scheduled messages
    if (!isAdmin(chatId)) {
        await bot.sendMessage(chatId, 'This command is only available to administrators.');
        return;
    }
    
    const text = msg.text || '';
    const match = text.match(/\/cancel_schedule\s+([^\s]+)/);
    
    if (!match || !match[1]) {
        await bot.sendMessage(chatId, 'Please specify the message ID. Example: /cancel_schedule msg-1234567890');
        return;
    }
    
    const messageId = match[1];
    const message = await getScheduledMessage(messageId);
    
    if (!message) {
        await bot.sendMessage(chatId, `No scheduled message found with ID: ${messageId}`);
        return;
    }
    
    if (message.sent) {
        await bot.sendMessage(chatId, `Message ${messageId} has already been sent and cannot be canceled.`);
        return;
    }
    
    await deleteScheduledMessage(messageId);
    
    await bot.sendMessage(chatId, `✅ Scheduled message with ID ${messageId} has been canceled.`);
}

/**
 * Process pending scheduled messages 
 * This should be called periodically, e.g., every minute
 */
export async function processPendingScheduledMessages(): Promise<void> {
    // Skip if scheduled messages are disabled
    if (process.env.SCHEDULED_MESSAGES_ENABLED !== 'true') {
        return;
    }
    
    const pendingMessages = await getPendingScheduledMessages();
    
    if (pendingMessages.length === 0) {
        return;
    }
    
    console.log(`[SCHEDULER] Processing ${pendingMessages.length} pending scheduled messages...`);
    
    for (const message of pendingMessages) {
        try {
            // Get target users based on message.targetUsers
            let targetUserIds: number[] = [];
            
            switch (message.targetUsers) {
                case 'all':
                    // Get all users who have ever interacted with the bot
                    const allUsers = await getAllTrackedUsers();
                    targetUserIds = allUsers.map(user => user.chatId);
                    break;
                    
                case 'connected':
                    // Get users who have a connected wallet
                    const connectedUsers = await getAllConnectedUsers();
                    targetUserIds = connectedUsers.map(user => user.chatId);
                    break;
                    
                case 'active':
                    // Get users who were active in the last 24 hours
                    const allUsers24h = await getAllTrackedUsers();
                    const last24h = Date.now() - 24 * 60 * 60 * 1000;
                    targetUserIds = allUsers24h
                        .filter(user => user.lastActivity && user.lastActivity > last24h)
                        .map(user => user.chatId);
                    break;
                    
                default:
                    // If targetUsers is an array of user IDs, use that
                    if (Array.isArray(message.targetUsers)) {
                        targetUserIds = message.targetUsers;
                    }
            }
            
            // Send the message to each target user
            let sentCount = 0;
            for (const userId of targetUserIds) {
                try {
                    await bot.sendMessage(userId, message.message);
                    sentCount++;
                } catch (error) {
                    console.error(`[SCHEDULER] Error sending message to user ${userId}:`, error);
                }
            }
            
            // Mark the message as sent
            message.sent = true;
            message.sentAt = Date.now();
            message.sentToCount = sentCount;
            await updateScheduledMessage(message);
            
            console.log(`[SCHEDULER] Sent scheduled message ${message.id} to ${sentCount} users`);
            
            // Notify the admin who created the message
            await bot.sendMessage(
                message.createdBy,
                `✅ Your scheduled message has been sent!\n\n` +
                `🆔 ID: ${message.id}\n` +
                `📊 Sent to: ${sentCount} users\n` +
                `📝 Message: "${message.message.substring(0, 50)}${message.message.length > 50 ? '...' : ''}"`
            );
        } catch (error) {
            console.error(`[SCHEDULER] Error processing scheduled message ${message.id}:`, error);
        }
    }
}
