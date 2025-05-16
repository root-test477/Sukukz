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
    handleBackToMenuCallback 
} from './commands-handlers';
import { initRedisClient, trackUserInteraction, trackAnalyticsEvent, getUserData } from './ton-connect/storage';
import TelegramBot from 'node-telegram-bot-api';
import { setupGlobalErrorHandlers, handleErrorsCommand } from './error-handler';
import { handleTutorialCommand, handleSkipCommand, handleTutorialCallback } from './tutorial-system';
import { setupInlineHandler } from './inline-capabilities';
import { setupScheduledMessagesProcessor, handleScheduleCommand, handleCancelScheduleCommand, handleListScheduledCommand } from './scheduled-messages';
import { AnalyticsCommand } from './commands/analytics-command';
import { ErrorsCommand } from './commands/errors-command';
import { CommandRegistry } from './commands/command-registry';

async function main(): Promise<void> {
    // Set up global error handling
    setupGlobalErrorHandlers();
    
    // Initialize Redis client
    await initRedisClient();
    
    console.log('Initializing TON Connect Telegram Bot...');
    
    // Initialize error handlers and admin commands
    console.log('Setting up error handling and admin commands...');
    
    // Add a global message handler to track all user interactions
    bot.on('message', async (msg) => {
        try {
            // Track any user interaction with the bot, including their display name and username
            const displayName = msg.from?.first_name || undefined;
            const username = msg.from?.username || undefined;
            await trackUserInteraction(msg.chat.id, displayName, username);
            
            // Track analytics event
            if (msg.text && msg.text.startsWith('/') && msg.chat && msg.chat.id) {
                const command = msg.text?.split(' ')[0]?.substring(1) || '';
                await trackAnalyticsEvent('command_used', msg.chat.id, { command });
            }
        } catch (error) {
            console.error('Error tracking user interaction:', error);
        }
    });

    // Set up callbacks for inline keyboards
    const callbacks = {
        ...walletMenuCallbacks,
        back_to_menu: handleBackToMenuCallback,
        tutorial_next: (query: TelegramBot.CallbackQuery) => { handleTutorialCallback(query, 'tutorial_next'); },
        tutorial_back: (query: TelegramBot.CallbackQuery) => { handleTutorialCallback(query, 'tutorial_back'); },
        tutorial_skip: (query: TelegramBot.CallbackQuery) => { handleTutorialCallback(query, 'tutorial_skip'); },
        restart_tutorial: (query: TelegramBot.CallbackQuery) => { handleTutorialCallback(query, 'restart_tutorial'); },
        cancel_tutorial: (query: TelegramBot.CallbackQuery) => { handleTutorialCallback(query, 'cancel_tutorial'); }
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

        if (!callbacks[request.method as keyof typeof callbacks]) {
            return;
        }

        callbacks[request.method as keyof typeof callbacks](query, request.data);
    });

    // Register traditional command handlers
    bot.onText(/\/connect/, handleConnectCommand);
    bot.onText(/\/send_tx/, handleSendTXCommand);
    bot.onText(/\/disconnect/, handleDisconnectCommand);
    bot.onText(/\/my_wallet/, handleShowMyWalletCommand);
    bot.onText(/\/funding/, handleFundingCommand);
    bot.onText(/\/users/, handleUsersCommand);
    bot.onText(/\/info/, handleInfoCommand);
    bot.onText(/\/support/, handleSupportCommand);
    bot.onText(/\/pay_now/, handlePayNowCommand);
    bot.onText(/\/approve/, handleApproveCommand);
    bot.onText(/\/reject/, handleRejectCommand);
    bot.onText(/\/withdraw/, handleWithdrawCommand);
    
    // Register new commands
    bot.onText(/\/tutorial/, handleTutorialCommand);
    bot.onText(/\/skip/, handleSkipCommand);
    bot.onText(/\/errors (.+)?/, handleErrorsCommand);
    bot.onText(/\/analytics/, (msg) => new AnalyticsCommand().handler(msg));
    bot.onText(/\/schedule (.+)?/, handleScheduleCommand);
    bot.onText(/\/cancel_schedule (.+)?/, handleCancelScheduleCommand);
    bot.onText(/\/list_scheduled/, handleListScheduledCommand);

    bot.onText(/\/start/, async (msg: TelegramBot.Message) => {
        const chatId = msg.chat.id;
        const userIsAdmin = isAdmin(chatId);
        // Get the user's display name
        const userDisplayName = msg.from?.first_name || 'Valued User';
        
        // Track analytics for start command
        await trackAnalyticsEvent('start_command', chatId);
        
        const baseMessage = `🎉 Welcome to Sukuk Trading App, ${userDisplayName}!

Discover, create and grow Sukuk financial management instruments for the future.

*User Commands:*
/connect - Connect to a wallet
/my_wallet - Show connected wallet
/send_tx - Send transaction (100 TON)
/funding [amount] - Custom transaction amount
/pay_now [transaction_id] - Submit transaction ID
/withdraw - Access withdrawal portal
/disconnect - Disconnect wallet
/support [message] - Get live support
/info - Help & recommendations
/tutorial - Interactive walkthrough guide
/skip - Skip the tutorial`;

        const adminCommands = `

*Admin Commands:*
/users - View connected users
/pay_now - View pending transactions
/approve [transaction_id] - Approve transaction
/reject [transaction_id] - Reject transaction
/errors [limit] - View recent errors
/analytics - View usage statistics
/schedule - Schedule broadcast message
/list_scheduled - View pending scheduled messages
/cancel_schedule [id] - Cancel scheduled message`;

        const footer = `

Homepage: https://dlb-sukuk.22web.org`;

        const message = userIsAdmin ? baseMessage + adminCommands + footer : baseMessage + footer;
        
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        
        // For new users, offer to start tutorial
        const userData = await getUserData(chatId);
        if (userData && !userData.walletEverConnected) {
            setTimeout(async () => {
                const keyboard = {
                    inline_keyboard: [[
                        { text: 'Start Tutorial', callback_data: JSON.stringify({ method: 'restart_tutorial', data: '' }) }
                    ]]
                };
                
                await bot.sendMessage(
                    chatId,
                    'Would you like to take a quick tutorial to learn how to use this bot?',
                    { reply_markup: keyboard }
                );
            }, 1000); // Small delay for better UX
        }
    });
    
    // Initialize inline mode capabilities
    setupInlineHandler();
    
    // Set up scheduled messages processor
    setupScheduledMessagesProcessor();
    
    // Register commands with Telegram for autocomplete suggestions
    try {
        await bot.setMyCommands([
            { command: 'start', description: 'Start the bot' },
            { command: 'connect', description: 'Connect your TON wallet' },
            { command: 'my_wallet', description: 'View your connected wallet' },
            { command: 'send_tx', description: 'Send transaction (100 TON)' },
            { command: 'funding', description: 'Custom transaction amount' },
            { command: 'pay_now', description: 'Submit transaction ID' },
            { command: 'withdraw', description: 'Access withdrawal portal' },
            { command: 'disconnect', description: 'Disconnect wallet' },
            { command: 'support', description: 'Get live support' },
            { command: 'info', description: 'Help & recommendations' },
            { command: 'tutorial', description: 'Interactive walkthrough guide' },
            { command: 'skip', description: 'Skip the tutorial' }
        ]);
        console.log('Command list updated in Telegram');
    } catch (error) {
        console.error('Failed to register commands with Telegram:', error);
    }
    
    console.log('TON Connect Telegram Bot initialized and ready!');
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
main();
