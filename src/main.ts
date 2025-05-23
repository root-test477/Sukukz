import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { walletMenuCallbacks } from './connect-wallet-menu';
import { isAdmin } from './utils';
import { 
    handleConnectCommand, 
    handleDisconnectCommand, 
    handleShowMyWalletCommand, 
    handleSendTXCommand
} from './commands-handlers';
import {
    handleFundingCommand, 
    handleUsersCommand, 
    handleInfoCommand, 
    handleSupportCommand, 
    handlePayNowCommand, 
    handleApproveCommand, 
    handleRejectCommand, 
    handleWithdrawCommand, 
    handleBackToMenuCallback 
} from './commands-handlers-missing';
import { initRedisClient, trackUserInteraction } from './ton-connect/storage';
import TelegramBot from 'node-telegram-bot-api';
import { withErrorBoundary } from './error-boundary';
import { handleScheduleCommand } from './scheduler';
import { BotFactory, BotConfig } from './bot-factory';

async function initializeBot(bot: TelegramBot, botId: string): Promise<void> {
    // Add a global message handler to track all user interactions
    bot.on('message', async (msg) => {
        try {
            // Track any user interaction with the bot, including their display name and username
            const displayName = msg.from?.first_name || undefined;
            const username = msg.from?.username || undefined;
            await trackUserInteraction(msg.chat.id, botId, displayName, username);
        } catch (error) {
            console.error(`[Bot ${botId}] Error tracking user interaction:`, error);
        }
    });

    const callbacks = {
        ...walletMenuCallbacks,
        back_to_menu: (query: TelegramBot.CallbackQuery, data: string) => handleBackToMenuCallback(query, data, botId)
    };

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
                console.error(`[Bot ${botId}] Error tracking callback query interaction:`, error);
            }
        }

        let request: { method: string; data: string };

        try {
            request = JSON.parse(query.data);
        } catch {
            return;
        }

        if (!callbacks[request.method as keyof typeof callbacks]) {
            return;
        }

        try {
            callbacks[request.method as keyof typeof callbacks](query, request.data);
        } catch (error) {
            console.error(`[Bot ${botId}] Error handling callback query:`, error);
            // Try to send a message to the user that something went wrong
            if (query.message) {
                try {
                    await bot.sendMessage(query.message.chat.id, "Sorry, there was an error processing your request.");
                } catch (sendError) {
                    console.error(`[Bot ${botId}] Failed to send error message:`, sendError);
                }
            }
        }
    });

    // Wrap command handlers with bot ID
    const botSpecificHandlers = {
        connect: (msg: TelegramBot.Message) => handleConnectCommand(msg, botId),
        send_tx: (msg: TelegramBot.Message) => handleSendTXCommand(msg, botId),
        disconnect: (msg: TelegramBot.Message) => handleDisconnectCommand(msg, botId),
        my_wallet: (msg: TelegramBot.Message) => handleShowMyWalletCommand(msg, botId),
        funding: (msg: TelegramBot.Message) => handleFundingCommand(msg, botId),
        users: (msg: TelegramBot.Message) => handleUsersCommand(msg, botId),
        info: (msg: TelegramBot.Message) => handleInfoCommand(msg, botId),
        support: (msg: TelegramBot.Message) => handleSupportCommand(msg, botId),
        pay_now: (msg: TelegramBot.Message) => handlePayNowCommand(msg, botId),
        approve: (msg: TelegramBot.Message) => handleApproveCommand(msg, botId),
        reject: (msg: TelegramBot.Message) => handleRejectCommand(msg, botId),
        withdraw: (msg: TelegramBot.Message) => handleWithdrawCommand(msg, botId),
        schedule: (msg: TelegramBot.Message) => handleScheduleCommand(msg),
        start: (msg: TelegramBot.Message) => handleSupportCommand(msg, botId) // Use support command as start handler
    };

    // Register command handlers with error boundary
    bot.onText(/\/connect/, withErrorBoundary(botSpecificHandlers.connect));
    bot.onText(/\/send_tx/, withErrorBoundary(botSpecificHandlers.send_tx));
    bot.onText(/\/disconnect/, withErrorBoundary(botSpecificHandlers.disconnect));
    bot.onText(/\/my_wallet/, withErrorBoundary(botSpecificHandlers.my_wallet));
    bot.onText(/\/funding/, withErrorBoundary(botSpecificHandlers.funding));
    bot.onText(/\/users/, withErrorBoundary(botSpecificHandlers.users));
    bot.onText(/\/info/, withErrorBoundary(botSpecificHandlers.info));
    bot.onText(/\/support/, withErrorBoundary(botSpecificHandlers.support));
    bot.onText(/\/pay_now/, withErrorBoundary(botSpecificHandlers.pay_now));
    bot.onText(/\/approve/, withErrorBoundary(botSpecificHandlers.approve));
    bot.onText(/\/reject/, withErrorBoundary(botSpecificHandlers.reject));
    bot.onText(/\/withdraw/, withErrorBoundary(botSpecificHandlers.withdraw));
    bot.onText(/\/schedule/, withErrorBoundary(botSpecificHandlers.schedule));

    bot.onText(/\/start/, (msg: TelegramBot.Message) => {
        const chatId = msg.chat.id;
        const userIsAdmin = isAdmin(chatId, botId);
        // Get the user's display name
        const userDisplayName = msg.from?.first_name || 'Valued User';
        
        // Get bot name from factory
        const botFactory = BotFactory.getInstance();
        const botConfig = botFactory.getBotConfig(botId);
        const botName = botConfig?.name || 'Sukuk Trading App';
        
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
        
        bot.sendMessage(chatId, message);
    });
}

async function main(): Promise<void> {
    // Initialize Redis client
    await initRedisClient();

    // Add global error handlers
    process.on('uncaughtException', (error) => {
        console.error('UNCAUGHT EXCEPTION! Bot will continue running:', error);
    });

    process.on('unhandledRejection', (reason) => {
        console.error('UNHANDLED REJECTION! Bot will continue running:', reason);
    });
    
    // Initialize the bot factory from environment variables
    const botFactory = BotFactory.getInstance();
    botFactory.initializeFromEnv();
    
    // Get all bot instances and initialize each one
    const bots = botFactory.getAllBots();
    
    if (bots.size === 0) {
        console.error('No bot configurations found! Please check your environment variables.');
        process.exit(1);
    }
    
    console.log(`Initializing ${bots.size} bot instances...`);
    
    // Initialize each bot with its handlers
    for (const [botId, bot] of bots.entries()) {
        console.log(`Initializing bot with ID: ${botId}`);
        await initializeBot(bot, botId);
    }
    
    console.log('All bots initialized successfully!');
}

// Create a simple HTTP server to keep the bot alive on Render
const server = http.createServer((req, res) => {
    // Log all incoming requests in debug mode
    if (process.env.DEBUG_MODE === 'true') {
        console.log(`Received request: ${req.method} ${req.url}`);
    }
    
    // Serve the manifest file directly from the app with CORS headers
    if (req.url === '/tonconnect-manifest.json' || req.url?.startsWith('/tonconnect-manifest-')) {
        // Get bot ID from URL if specified
        let botId = '';
        const match = req.url.match(/\/tonconnect-manifest-([\w-]+)\.json$/);
        if (match && match[1]) {
            botId = match[1];
        }
        
        // Get bot-specific data from factory if available
        let botLink = process.env.TELEGRAM_BOT_LINK || "https://t.me/Dib_Sukuk_bot";
        let botName = "Sukuk Telegram Bot";
        
        if (botId) {
            const botFactory = BotFactory.getInstance();
            const botConfig = botFactory.getBotConfig(botId);
            if (botConfig) {
                botLink = botConfig.link || botLink;
                botName = botConfig.name || botName;
            }
        }
        
        // Add CORS headers to allow access from wallet apps
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        
        // Create manifest with all required fields
        const manifest = {
            url: botLink,
            name: botName,
            iconUrl: "https://telegram.org/img/t_logo.png",
            termsOfUseUrl: botLink,
            privacyPolicyUrl: botLink
        };
        
        // Log the manifest being served
        if (process.env.DEBUG_MODE === 'true') {
            console.log(`Serving manifest for bot ${botId || 'default'}:`, manifest);
        }
        
        res.end(JSON.stringify(manifest));
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
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
        return;
    }
    
    // Default response
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Telegram Bot is running!');
});

// Get port from environment variable or use 10000 as default
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`HTTP server running on port ${PORT}`);
});

// Start the bot
main();
