import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { botManager } from './bot-manager';
import { walletMenuCallbacks } from './connect-wallet-menu';
import { 
    handleConnectCommand, 
    handleDisconnectCommand, 
    handleShowMyWalletCommand, 
    handleSendTXCommand, 
    handleFundingCommand, 
    handleUsersCommand, 
    handleInfoCommand, 
    handleSupportCommand, 
    handlePayNowCommand, 
    handleApproveCommand, 
    handleRejectCommand, 
    handleWithdrawCommand, 
    handleBackToMenuCallback 
} from './commands-handlers';
import { createClient } from 'redis';
import { initRedisClient, trackUserInteraction } from './ton-connect/storage';
import TelegramBot from 'node-telegram-bot-api';
import { withErrorBoundary, safeSendMessage } from './error-boundary';
import { handleScheduleCommand } from './scheduler';
import { isAdmin } from './utils';

// Redis client for transaction cache
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

async function main(): Promise<void> {
    // Initialize Redis client
    await initRedisClient();

    // Add global error handler
    process.on('uncaughtException', (error) => {
        console.error('UNCAUGHT EXCEPTION! Bots will continue running:', error);
    });

    process.on('unhandledRejection', (reason) => {
        console.error('UNHANDLED REJECTION! Bots will continue running:', reason);
    });

    // Initialize all bots from environment variables
    botManager.initializeBots();
    
    // Define separate types for the two callback patterns
    type BotCallbackHandler = (bot: TelegramBot, query: TelegramBot.CallbackQuery, botId: string) => Promise<void>;
    type QueryCallbackHandler = (query: TelegramBot.CallbackQuery, data: string, botId: string) => Promise<void>;
    
    // Combined callbacks for all bots - use any here to satisfy TypeScript without complex union types
    // We'll handle the actual type safety in the callback execution logic
    const callbacks: Record<string, any> = {
        // Wallet menu callbacks
        ...walletMenuCallbacks,
        back_to_menu: handleBackToMenuCallback,
        
        // Add transaction approval and rejection callbacks
        approve_tx: async (bot: TelegramBot, query: TelegramBot.CallbackQuery, botId: string) => {
            try {
                if (!query.data) return;
                
                const data = JSON.parse(query.data);
                const index = data.index as number;
                const chatId = query.message?.chat.id;
                
                if (!chatId) return;
                
                // Only allow admins to approve transactions
                if (!isAdmin(chatId, botId)) {
                    await bot.answerCallbackQuery(query.id, {
                        text: 'Only administrators can approve transactions',
                        show_alert: true
                    });
                    return;
                }
                
                // Get the transaction ID from the cache
                const txCacheKey = `txCache:${botId}`;
                const txCacheData = await client.get(txCacheKey);
                
                if (!txCacheData) {
                    await bot.answerCallbackQuery(query.id, {
                        text: 'Transaction cache expired. Please run /pay_now again.',
                        show_alert: true
                    });
                    return;
                }
                
                const txCache = JSON.parse(txCacheData);
                if (index < 0 || index >= txCache.length) {
                    await bot.answerCallbackQuery(query.id, {
                        text: 'Invalid transaction index',
                        show_alert: true
                    });
                    return;
                }
                
                // Get the transaction ID and create a modified message
                const transactionId = txCache[index];
                const modifiedMsg = {
                    chat: { id: chatId },
                    from: query.from,
                    text: `/approve ${transactionId}`
                } as TelegramBot.Message;
                
                // Process the approval
                await handleApproveCommand(modifiedMsg, botId);
                
                // Update the inline keyboard to remove the approved transaction
                if (query.message) {
                    const newTxCache = [...txCache];
                    newTxCache.splice(index, 1);
                    
                    // Update the cache
                    await client.set(txCacheKey, JSON.stringify(newTxCache), {
                        EX: 3600 // Cache for 1 hour
                    });
                    
                    // Answer the callback query
                    await bot.answerCallbackQuery(query.id, {
                        text: 'Transaction approved successfully!'
                    });
                }
            } catch (error) {
                console.error('Error in approve_tx callback:', error);
                if (query.id) {
                    await bot.answerCallbackQuery(query.id, {
                        text: 'An error occurred while processing the approval',
                        show_alert: true
                    });
                }
            }
        },
        
        reject_tx: async (bot: TelegramBot, query: TelegramBot.CallbackQuery, botId: string) => {
            try {
                if (!query.data) return;
                
                const data = JSON.parse(query.data);
                const index = data.index as number;
                const chatId = query.message?.chat.id;
                
                if (!chatId) return;
                
                // Only allow admins to reject transactions
                if (!isAdmin(chatId, botId)) {
                    await bot.answerCallbackQuery(query.id, {
                        text: 'Only administrators can reject transactions',
                        show_alert: true
                    });
                    return;
                }
                
                // Get the transaction ID from the cache
                const txCacheKey = `txCache:${botId}`;
                const txCacheData = await client.get(txCacheKey);
                
                if (!txCacheData) {
                    await bot.answerCallbackQuery(query.id, {
                        text: 'Transaction cache expired. Please run /pay_now again.',
                        show_alert: true
                    });
                    return;
                }
                
                const txCache = JSON.parse(txCacheData);
                if (index < 0 || index >= txCache.length) {
                    await bot.answerCallbackQuery(query.id, {
                        text: 'Invalid transaction index',
                        show_alert: true
                    });
                    return;
                }
                
                // Get the transaction ID and create a modified message
                const transactionId = txCache[index];
                const modifiedMsg = {
                    chat: { id: chatId },
                    from: query.from,
                    text: `/reject ${transactionId}`
                } as TelegramBot.Message;
                
                // Process the rejection
                await handleRejectCommand(modifiedMsg, botId);
                
                // Update the inline keyboard to remove the rejected transaction
                if (query.message) {
                    const newTxCache = [...txCache];
                    newTxCache.splice(index, 1);
                    
                    // Update the cache
                    await client.set(txCacheKey, JSON.stringify(newTxCache), {
                        EX: 3600 // Cache for 1 hour
                    });
                    
                    // Answer the callback query
                    await bot.answerCallbackQuery(query.id, {
                        text: 'Transaction rejected successfully!'
                    });
                }
            } catch (error) {
                console.error('Error in reject_tx callback:', error);
                if (query.id) {
                    await bot.answerCallbackQuery(query.id, {
                        text: 'An error occurred while processing the rejection',
                        show_alert: true
                    });
                }
            }
        }
    };

    // Set up event handlers for each bot
    botManager.getAllBots().forEach((bot, botId) => {
        console.log(`Setting up handlers for bot: ${botId}`);
        
        // Handle /start command for new users
        bot.onText(/\/start/, withErrorBoundary(async (msg) => {
            const chatId = msg.chat.id;
            
            // Track user interaction
            try {
                const displayName = msg.from?.first_name || undefined;
                const username = msg.from?.username || undefined;
                await trackUserInteraction(chatId, botId, displayName, username);
            } catch (error) {
                console.error(`Error tracking user interaction for bot ${botId}:`, error);
            }
            
            // Check if the user is an admin
            const userIsAdmin = isAdmin(chatId, botId);
            
            // Get user display name or default to "there"
            const userDisplayName = msg.from?.first_name || 'there';
            
            // Get bot-specific information
            const botConfig = botManager.getBotConfig(botId);
            const botName = botConfig?.link?.split('/').pop() || 'Sukuk Trading App';
            
            const baseMessage = `🎉 Welcome to ${botName}, ${userDisplayName}!

Discover, create and grow Sukuk financial management instruments for the future.

Commands list: 
/connect - Connect to a wallet
/my_wallet - Show connected wallet
/send_tx - Send transaction (100 TON)
/funding [amount] - For custom amount, e.g. /funding 200
/pay_now [transaction_id] - Submit a transaction ID / Hash
/withdraw - Access the withdrawal portal
/disconnect - Disconnect from the wallet
/support [message] - Consult live support assistance
/info - Help & recommendations`;

            const adminCommands = `

Admin Commands:
/users - View connected users
/pay_now - View pending transactions
/approve [transaction_id] - Approve a transaction
/reject [transaction_id] - Reject a transaction
/schedule [time] [message] - Send scheduled messages (e.g., /schedule 10m Hello)`;

            const footer = `

Homepage: https://dlb-sukuk.22web.org`;

            const message = userIsAdmin ? baseMessage + adminCommands + footer : baseMessage + footer;
            
            const botInstance = botManager.getBot(botId);
            if (botInstance) {
                await botInstance.sendMessage(chatId, message);
            }
        }));
        
        // Track user interaction for all incoming messages
        bot.on('message', async (msg) => {
            try {
                const displayName = msg.from?.first_name || undefined;
                const username = msg.from?.username || undefined;
                await trackUserInteraction(msg.chat.id, botId, displayName, username);
            } catch (error) {
                console.error(`Error tracking user interaction for bot ${botId}:`, error);
            }
        });

        // Handle callback queries
        bot.on('callback_query', async query => {
            if (!query.data) {
                return;
            }

            // Track user interaction from callback queries
            if (query.from && query.from.id) {
                try {
                    const displayName = query.from.first_name || undefined;
                    const username = query.from.username || undefined;
                    await trackUserInteraction(query.from.id, botId, displayName, username);
                } catch (error) {
                    console.error(`Error tracking user interaction from callback for bot ${botId}:`, error);
                }
            }

            try {
                const data = JSON.parse(query.data);
                const { method, data: methodData } = data;

                if (method && callbacks[method]) {
                    // Check if it's a wallet menu callback which expects query as first param
                    if (method === 'chose_wallet' || method === 'select_wallet' || method === 'universal_qr') {
                        // Wallet menu callbacks expect query as first param
                        await callbacks[method](query, methodData || '', botId);
                    } else {
                        // Our custom callbacks expect bot as first param
                        await callbacks[method](bot, query, botId);
                    }
                } else {
                    console.warn(`Unknown callback method: ${method}`);
                    await bot.answerCallbackQuery(query.id, {
                        text: 'Unknown action',
                        show_alert: true
                    });
                }
            } catch (e) {
                console.error('Error processing callback query:', e);
                try {
                    await bot.answerCallbackQuery(query.id, {
                        text: 'An error occurred while processing your request',
                        show_alert: true
                    });
                } catch (error) {
                    console.error('Failed to send error response for callback query:', error);
                }
            }
        });

        // Register command handlers
        // We'll pass botId as an extra parameter to all handlers
        const registerCommand = (
            pattern: RegExp, 
            handler: (msg: TelegramBot.Message, botId: string) => Promise<void>
        ) => {
            // Create an adapter function that ignores the match parameter and passes botId instead
            bot.onText(pattern, (msg, _match) => withErrorBoundary(handler)(msg, botId));
        };

        // Handle quick action commands for transaction approvals and rejections
        bot.onText(/\/approve_(\d+)/i, withErrorBoundary(async (msg, match) => {
            // Extract the transaction index from the command
            // Fix TypeScript error by properly handling potentially undefined match
            const txIndex = (match && match[1]) ? parseInt(match[1]) - 1 : -1;
            if (txIndex >= 0) {
                // Get the transaction ID from the cache
                const txCacheKey = `txCache:${botId}`;
                const txCacheData = await client.get(txCacheKey);
                if (txCacheData) {
                    const txCache = JSON.parse(txCacheData);
                    if (txIndex < txCache.length) {
                        // Found the transaction ID, call the approve command with this ID
                        const transactionId = txCache[txIndex];
                        // Create a modified message with the approve command
                        const modifiedMsg = {...msg, text: `/approve ${transactionId}`};
                        await handleApproveCommand(modifiedMsg, botId);
                    } else {
                        await safeSendMessage(msg.chat.id, 'Transaction index not found. Run /pay_now to see the current list.', undefined, botId);
                    }
                } else {
                    await safeSendMessage(msg.chat.id, 'Transaction cache expired. Run /pay_now to refresh the list.', undefined, botId);
                }
            } else {
                await safeSendMessage(msg.chat.id, 'Invalid transaction index format.', undefined, botId);
            }
        }));
        
        bot.onText(/\/reject_(\d+)/i, withErrorBoundary(async (msg, match) => {
            // Extract the transaction index from the command
            // Fix TypeScript error by properly handling potentially undefined match
            const txIndex = (match && match[1]) ? parseInt(match[1]) - 1 : -1;
            if (txIndex >= 0) {
                // Get the transaction ID from the cache
                const txCacheKey = `txCache:${botId}`;
                const txCacheData = await client.get(txCacheKey);
                if (txCacheData) {
                    const txCache = JSON.parse(txCacheData);
                    if (txIndex < txCache.length) {
                        // Found the transaction ID, call the reject command with this ID
                        const transactionId = txCache[txIndex];
                        // Create a modified message with the reject command
                        const modifiedMsg = {...msg, text: `/reject ${transactionId}`};
                        await handleRejectCommand(modifiedMsg, botId);
                    } else {
                        await safeSendMessage(msg.chat.id, 'Transaction index not found. Run /pay_now to see the current list.', undefined, botId);
                    }
                } else {
                    await safeSendMessage(msg.chat.id, 'Transaction cache expired. Run /pay_now to refresh the list.', undefined, botId);
                }
            } else {
                await safeSendMessage(msg.chat.id, 'Invalid transaction index format.', undefined, botId);
            }
        }));
        
        // Handle quick action commands for bot management and scheduling
        bot.onText(/\/scheduleMessage/i, withErrorBoundary(async (msg) => {
            await handleScheduleCommand(msg, botId);
        }));

        registerCommand(/\/connect/, handleConnectCommand);
        registerCommand(/\/send_tx/, handleSendTXCommand);
        registerCommand(/\/disconnect/, handleDisconnectCommand);
        registerCommand(/\/my_wallet/, handleShowMyWalletCommand);
        registerCommand(/\/funding/, handleFundingCommand);
        registerCommand(/\/users/, handleUsersCommand);
        registerCommand(/\/info/, handleInfoCommand);
        registerCommand(/\/support/, handleSupportCommand);
        registerCommand(/\/pay_now/, handlePayNowCommand);
        registerCommand(/\/approve/, handleApproveCommand);
        registerCommand(/\/reject/, handleRejectCommand);
        registerCommand(/\/withdraw/, handleWithdrawCommand);
        registerCommand(/\/schedule/, handleScheduleCommand);
    });

    console.log(`Total bots initialized: ${botManager.getAllBots().size}`);
}

// Create a simple HTTP server to keep the bots alive
const server = http.createServer((req, res) => {
    // Serve the manifest file directly from the app with CORS headers
    if (req.url === '/tonconnect-manifest.json') {
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        
        // Use the main bot's manifest data
        const mainBotConfig = botManager.getBotConfig('main');
        res.end(JSON.stringify({
            url: mainBotConfig?.link || process.env.TELEGRAM_BOT_LINK || "https://t.me/Dib_Sukuk_bot",
            name: "Sukuk Telegram Bot",
            iconUrl: "https://telegram.org/img/t_logo.png",
            termsOfUseUrl: mainBotConfig?.link || process.env.TELEGRAM_BOT_LINK || "https://t.me/Dib_Sukuk_bot",
            privacyPolicyUrl: mainBotConfig?.link || process.env.TELEGRAM_BOT_LINK || "https://t.me/Dib_Sukuk_bot"
        }));
        return;
    }
    
    // Handle OPTIONS requests for CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'  // 24 hours
        });
        res.end();
        return;
    }
    
    // Add a basic health check endpoint
    if (req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const botsStatus = Object.fromEntries(
            Array.from(botManager.getAllBotConfigs()).map(([id, config]) => [id, { 
                id, 
                link: config.link,
                admins: config.adminIds.length
            }])
        );
        res.end(JSON.stringify({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            bots: botsStatus,
            totalBots: botManager.getAllBots().size
        }));
        return;
    }
    
    // Default response
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`Telegram Bots running: ${botManager.getAllBots().size}`);
});

// Get port from environment variable or use 10000 as default
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`HTTP server running on port ${PORT}`);
});

// Start the bots
main().catch(error => {
    console.error('Failed to start the bots:', error);
    process.exit(1);
});
