import { CHAIN, isTelegramUrl, toUserFriendlyAddress, UserRejectsError } from '@tonconnect/sdk';
import { getWallets, getWalletInfo } from './ton-connect/wallets';
import { BotFactory } from './bot-factory';
import { saveConnectedUser, removeConnectedUser, updateUserActivity, getAllConnectedUsers, saveSupportMessage, getSupportMessagesForUser, saveTransactionSubmission, updateTransactionStatus, getTransactionSubmission, getAllPendingTransactions, TransactionSubmission, trackUserInteraction, getAllTrackedUsers } from './ton-connect/storage';
import { isAdmin } from './utils';
import QRCode from 'qrcode';
import TelegramBot from 'node-telegram-bot-api';
import { getConnector } from './ton-connect/connector';
import { addTGReturnStrategy, buildUniversalKeyboard, pTimeout, pTimeoutException } from './utils';
import { safeSendMessage } from './error-boundary';

// Store listeners with a composite key (chatId:botId)
let newConnectRequestListenersMap = new Map<string, () => void>();

// Helper function to create a listener key
function getListenerKey(chatId: number, botId: string): string {
    return `${chatId}:${botId}`;
}

export async function handleConnectCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    // Get the bot instance for this botId
    const botFactory = BotFactory.getInstance();
    const bot = botFactory.getBot(botId);
    if (!bot) {
        console.error(`Bot with ID ${botId} not found`);
        return;
    }
    const chatId = msg.chat.id;
    let messageWasDeleted = false;
    
    const listenerKey = getListenerKey(chatId, botId);
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
        await bot.sendMessage(
            chatId,
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
            // Save the connected user to storage
            await saveConnectedUser(chatId, botId, wallet.account.address);
            
            await bot.sendMessage(chatId, `${walletName} wallet connected successfully`);
            unsubscribe();
            newConnectRequestListenersMap.delete(listenerKey);
        }
    });

    const wallets = await getWallets();

    const link = connector.connect(wallets);
    const image = await QRCode.toBuffer(link);

    const keyboard = await buildUniversalKeyboard(link, wallets, botId);

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

    newConnectRequestListenersMap.set(listenerKey, async () => {
        unsubscribe();

        await deleteMessage();

        newConnectRequestListenersMap.delete(listenerKey);
    });
}

export async function handleSendTXCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    // Get the bot instance for this botId
    const botFactory = BotFactory.getInstance();
    const bot = botFactory.getBot(botId);
    if (!bot) {
        console.error(`Bot with ID ${botId} not found`);
        return;
    }
    const chatId = msg.chat.id;

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
            await updateUserActivity(chatId, botId, amount);
            await bot.sendMessage(chatId, `Transaction sent successfully`);
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
    // Get the bot instance for this botId
    const botFactory = BotFactory.getInstance();
    const bot = botFactory.getBot(botId);
    if (!bot) {
        console.error(`Bot with ID ${botId} not found`);
        return;
    }
    const chatId = msg.chat.id;

    const connector = getConnector(chatId, botId);

    await connector.restoreConnection();
    if (!connector.connected) {
        await bot.sendMessage(chatId, "You didn't connect a wallet");
        return;
    }

    await connector.disconnect();
    
    // Remove user from tracking when they disconnect
    await removeConnectedUser(chatId, botId);

    await bot.sendMessage(chatId, 'Wallet has been disconnected');
}

/**
 * Attempt to safely restore a wallet connection with retries
 * @param connector - The connector to restore
 * @param chatId - The chat ID for logging
 * @param botId - The bot ID for logging
 * @returns true if connection was successful, false otherwise
 */
export async function safeRestoreConnection(connector: any, chatId: number, _botId: string): Promise<boolean> {
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

export async function handleShowMyWalletCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    // Get the bot instance for this botId
    const botFactory = BotFactory.getInstance();
    const bot = botFactory.getBot(botId);
    if (!bot) {
        console.error(`Bot with ID ${botId} not found`);
        return;
    }
    const chatId = msg.chat.id;

    const connector = getConnector(chatId, botId);

    // Use our enhanced connection method
    const connected = await safeRestoreConnection(connector, chatId, botId);
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
}

/**
 * Handler for the /approve_transaction command (admin-only)
 * Approves a pending transaction that a user has submitted via /transaction command
 */
export async function handleApproveTransactionCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    
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
    
    // Get transaction ID from command message
    const match = msg.text?.match(/\/approve_transaction\s+(.+)/);
    
    if (!match || !match[1]) {
        await bot.sendMessage(chatId, 'Please provide a transaction ID to approve. Example: /approve [transaction_id]');
        return;
    }
    
    // ... (rest of the function remains the same)
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
 * Handler for the /user command (admin-only)
 * Shows detailed information about a user by ID or username
 */
export async function handleUserCommand(msg: TelegramBot.Message, botId: string): Promise<void> {
    const chatId = msg.chat.id;
    
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
    
    // ... (rest of the function remains the same)
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
    await bot.sendMessage(chatId, '*User information listing not yet implemented for multi-bot mode*', { parse_mode: 'Markdown' });
}
