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
import { initRedisClient, trackUserInteraction } from './ton-connect/storage';
import TelegramBot from 'node-telegram-bot-api';
import { withErrorBoundary } from './error-boundary';
import { handleScheduleCommand } from './scheduler';

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
    
    // Combined callbacks for all bots
    const callbacks = {
        ...walletMenuCallbacks,
        back_to_menu: handleBackToMenuCallback
    };

    // Set up event handlers for each bot
    botManager.getAllBots().forEach((bot, botId) => {
        console.log(`Setting up event handlers for bot: ${botId}`);
        
        // Track user interactions
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
                    console.error(`Error tracking callback query interaction for bot ${botId}:`, error);
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
                // Pass botId to the callback handler
                const callbackHandler = callbacks[request.method as keyof typeof callbacks];
                // @ts-ignore - We're adding botId as an extra parameter
                callbackHandler(query, request.data, botId);
            } catch (error) {
                console.error(`Error handling callback query for bot ${botId}:`, error);
                if (query.message) {
                    try {
                        const botInstance = botManager.getBot(botId);
                        if (botInstance) {
                            await botInstance.sendMessage(query.message.chat.id, "Sorry, there was an error processing your request.");
                        }
                    } catch (sendError) {
                        console.error(`Failed to send error message for bot ${botId}:`, sendError);
                    }
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

        registerCommand(/\/start/, async (msg: TelegramBot.Message, botId: string) => {
            const chatId = msg.chat.id;
            const userIsAdmin = botManager.isAdmin(chatId, botId);
            const userDisplayName = msg.from?.first_name || 'Valued User';
            
            // Get bot-specific config
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
        });
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
