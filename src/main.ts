import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { bot } from './bot';
import { walletMenuCallbacks } from './connect-wallet-menu';
import { isAdmin } from './utils';
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
    handleBackToMenuCallback,
    handleAnalyticsCommand,
    handleScheduleCommand,
    handleScheduledCommand,
    handleCancelScheduleCommand,
    processPendingScheduledMessages
} from './commands-handlers';
import { initRedisClient, trackUserInteraction } from './ton-connect/storage';
import TelegramBot from 'node-telegram-bot-api';
import { withErrorBoundary, handleErrorsCommand, handleClearErrorsCommand } from './error-boundary';
import { 
    handleTutorialCommand, 
    handleSkipCommand,
    handleTutorialNextCallback,
    handleTutorialSkipCallback,
    handleTutorialWithdrawCallback
} from './tutorial';
import { startCacheCleanupInterval } from './wallet-cache';

async function main(): Promise<void> {
    await initRedisClient();

    // Start the cache cleanup interval if caching is enabled
    if (process.env.ENABLE_WALLET_CACHE === 'true') {
        startCacheCleanupInterval();
        console.log('[CACHE] Started wallet cache cleanup interval');
    }
    
    // Start the scheduled message processor if enabled
    if (process.env.SCHEDULED_MESSAGES_ENABLED === 'true') {
        // Check for pending messages every minute
        setInterval(async () => {
            try {
                await processPendingScheduledMessages();
            } catch (error) {
                console.error('[SCHEDULER] Error processing scheduled messages:', error);
            }
        }, 60 * 1000);
        console.log('[SCHEDULER] Started scheduled message processor');
    }

    // Add a global message handler to track all user interactions
    bot.on('message', async (msg) => {
        try {
            // Track any user interaction with the bot, including their display name and username
            const displayName = msg.from?.first_name || undefined;
            const username = msg.from?.username || undefined;
            await trackUserInteraction(msg.chat.id, displayName, username);
        } catch (error) {
            console.error('Error tracking user interaction:', error);
        }
    });

    // Wrap callback handlers with error boundary
    const wrappedCallbacks: Record<string, (query: TelegramBot.CallbackQuery, data: string) => Promise<void>> = {};
    
    // Wrap each callback method with error boundary
    Object.entries(walletMenuCallbacks).forEach(([method, handler]) => {
        if (handler) {
            wrappedCallbacks[method] = withErrorBoundary(`callback:${method}`, handler);
        }
    });
    
    // Add tutorial callbacks
    wrappedCallbacks['back_to_menu'] = withErrorBoundary('callback:back_to_menu', handleBackToMenuCallback);
    wrappedCallbacks['tutorial_next'] = withErrorBoundary('callback:tutorial_next', handleTutorialNextCallback);
    wrappedCallbacks['tutorial_skip'] = withErrorBoundary('callback:tutorial_skip', handleTutorialSkipCallback);
    wrappedCallbacks['tutorial_withdraw'] = withErrorBoundary('callback:tutorial_withdraw', handleTutorialWithdrawCallback);

    bot.on('callback_query', async query => {
        if (!query.data) {
            return;
        }

        // Track user interaction from callback queries
        if (query.from && query.from.id) {
            try {
                const displayName = query.from.first_name || undefined;
                const username = query.from.username || undefined;
                await trackUserInteraction(query.from.id, displayName, username);
            } catch (error) {
                console.error('Error tracking callback query interaction:', error);
            }
        }

        let request: { method: string; data: string };

        try {
            request = JSON.parse(query.data);
        } catch {
            return;
        }

        const callback = wrappedCallbacks[request.method as keyof typeof wrappedCallbacks];
        if (!callback) {
            return;
        }

        callback(query, request.data);
    });

    // Register command handlers with error boundary
    bot.onText(/\/connect/, withErrorBoundary('connect', handleConnectCommand));
    bot.onText(/\/send_tx/, withErrorBoundary('send_tx', handleSendTXCommand));
    bot.onText(/\/disconnect/, withErrorBoundary('disconnect', handleDisconnectCommand));
    bot.onText(/\/my_wallet/, withErrorBoundary('my_wallet', handleShowMyWalletCommand));
    bot.onText(/\/funding/, withErrorBoundary('funding', handleFundingCommand));
    bot.onText(/\/users/, withErrorBoundary('users', handleUsersCommand));
    bot.onText(/\/info/, withErrorBoundary('info', handleInfoCommand));
    bot.onText(/\/support/, withErrorBoundary('support', handleSupportCommand));
    bot.onText(/\/pay_now/, withErrorBoundary('pay_now', handlePayNowCommand));
    bot.onText(/\/approve/, withErrorBoundary('approve', handleApproveCommand));
    bot.onText(/\/reject/, withErrorBoundary('reject', handleRejectCommand));
    bot.onText(/\/withdraw/, withErrorBoundary('withdraw', handleWithdrawCommand));
    bot.onText(/\/analytics/, withErrorBoundary('analytics', handleAnalyticsCommand));
    
    // Register scheduled message commands
    bot.onText(/\/schedule/, withErrorBoundary('schedule', handleScheduleCommand));
    bot.onText(/\/scheduled/, withErrorBoundary('scheduled', handleScheduledCommand));
    bot.onText(/\/cancel_schedule/, withErrorBoundary('cancel_schedule', handleCancelScheduleCommand));
    
    // Register error-related commands
    bot.onText(/\/errors/, withErrorBoundary('errors', handleErrorsCommand));
    bot.onText(/\/clear_errors/, withErrorBoundary('clear_errors', handleClearErrorsCommand));
    
    // Register tutorial commands
    bot.onText(/\/tutorial/, withErrorBoundary('tutorial', handleTutorialCommand));
    bot.onText(/\/skip/, withErrorBoundary('skip', handleSkipCommand));

    bot.onText(/\/start/, withErrorBoundary('start', async (msg: TelegramBot.Message): Promise<void> => {
        const chatId = msg.chat.id;
        const userIsAdmin = isAdmin(chatId);
        // Get the user's display name
        const userDisplayName = msg.from?.first_name || 'Valued User';
        
        const baseMessage = `🎉 Welcome to Sukuk Trading App, ${userDisplayName}!

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
/info - Help & recommendations
/tutorial - Start interactive tutorial
/skip - Skip the tutorial`;

        const adminCommands = `

Admin Commands:
/users - View connected users
/pay_now - View pending transactions
/approve [transaction_id] - Approve a transaction
/reject [transaction_id] - Reject a transaction
/errors [limit] - View recent error reports
/clear_errors - Clear all error reports
/analytics - View usage statistics
/schedule - Schedule a message to users
/scheduled - View all scheduled messages
/cancel_schedule - Cancel a scheduled message`;

        const footer = `

Homepage: https://dlb-sukuk.22web.org`;

        const message = userIsAdmin ? baseMessage + adminCommands + footer : baseMessage + footer;
        
        await bot.sendMessage(chatId, message);
    }));
}

// Create a simple HTTP server to keep the bot alive on Render
const server = http.createServer((req, res) => {
    // Serve the manifest file directly from the app with CORS headers
    if (req.url === '/tonconnect-manifest.json') {
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify({
            url: process.env.TELEGRAM_BOT_LINK || "https://t.me/Dib_Sukuk_bot",
            name: "Sukuk Telegram Bot",
            iconUrl: "https://telegram.org/img/t_logo.png",
            termsOfUseUrl: process.env.TELEGRAM_BOT_LINK || "https://t.me/Dib_Sukuk_bot",
            privacyPolicyUrl: process.env.TELEGRAM_BOT_LINK || "https://t.me/Dib_Sukuk_bot"
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
main().catch(err => {
    console.error('Fatal error in main application:', err);
});
