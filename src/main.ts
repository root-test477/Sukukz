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
import { initRedisClient, trackUserInteraction } from './ton-connect/storage';
import TelegramBot from 'node-telegram-bot-api';

// Import new feature handlers
import { handleLanguageCommand } from './language-handler';
import { handleTutorialCommand, handleTutorialTypeCallback } from './tutorial';
import { handleAnalyticsCommand } from './analytics-service';
import { handleTestCommand, handleTestResultsCommand } from './testing/test-runner';

async function main(): Promise<void> {
    await initRedisClient();

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

    const callbacks = {
        ...walletMenuCallbacks,
        back_to_menu: handleBackToMenuCallback,
        // Add callbacks for tutorial navigation
        tutorial_type_general: handleTutorialTypeCallback,
        tutorial_type_wallet: handleTutorialTypeCallback,
        tutorial_type_transaction: handleTutorialTypeCallback
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

    bot.onText(/\/connect/, handleConnectCommand);

    bot.onText(/\/send_tx/, handleSendTXCommand);

    bot.onText(/\/disconnect/, handleDisconnectCommand);

    bot.onText(/\/my_wallet/, handleShowMyWalletCommand);

    // Handle custom funding amount command
    bot.onText(/\/funding/, handleFundingCommand);

    // Registration for user-accessible commands
    bot.onText(/\/info/, handleInfoCommand);
    bot.onText(/\/support/, handleSupportCommand);
    bot.onText(/\/pay_now/, handlePayNowCommand);
    bot.onText(/\/withdraw/, handleWithdrawCommand);
    bot.onText(/\/language/, handleLanguageCommand);
    bot.onText(/\/tutorial/, handleTutorialCommand);
    
    // Register admin-only commands with silentFail=true to ignore non-admin access attempts
    bot.onText(/\/approve/, (msg) => {
        const chatId = msg.chat.id;
        if (!isAdmin(chatId)) {
            console.log(`[ADMIN] Unauthorized access attempt to /approve by user ${chatId}`);
            return; // Silently fail for non-admins
        }
        handleApproveCommand(msg);
    });
    
    bot.onText(/\/reject/, (msg) => {
        const chatId = msg.chat.id;
        if (!isAdmin(chatId)) {
            console.log(`[ADMIN] Unauthorized access attempt to /reject by user ${chatId}`);
            return; // Silently fail for non-admins
        }
        handleRejectCommand(msg);
    });
    
    bot.onText(/\/users/, (msg) => {
        const chatId = msg.chat.id;
        if (!isAdmin(chatId)) {
            console.log(`[ADMIN] Unauthorized access attempt to /users by user ${chatId}`);
            return; // Silently fail for non-admins
        }
        handleUsersCommand(msg);
    });
    
    bot.onText(/\/analytics/, (msg) => {
        const chatId = msg.chat.id;
        if (!isAdmin(chatId)) {
            console.log(`[ADMIN] Unauthorized access attempt to /analytics by user ${chatId}`);
            return; // Silently fail for non-admins
        }
        handleAnalyticsCommand(msg);
    });
    
    bot.onText(/\/test/, (msg) => {
        const chatId = msg.chat.id;
        if (!isAdmin(chatId)) {
            console.log(`[ADMIN] Unauthorized access attempt to /test by user ${chatId}`);
            return; // Silently fail for non-admins
        }
        handleTestCommand(msg);
    });
    
    bot.onText(/\/test_results/, (msg) => {
        const chatId = msg.chat.id;
        if (!isAdmin(chatId)) {
            console.log(`[ADMIN] Unauthorized access attempt to /test_results by user ${chatId}`);
            return; // Silently fail for non-admins
        }
        handleTestResultsCommand(msg);
    });

    bot.onText(/\/start/, (msg: TelegramBot.Message) => {
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
/language - Change bot language
/tutorial - Access interactive tutorials`;

        const adminCommands = `

Admin Commands:
/users - View connected users
/pay_now - View pending transactions
/approve [transaction_id] - Approve a transaction
/reject [transaction_id] - Reject a transaction
/analytics - View usage statistics
/test - Run system tests
/test_results - View test results`;

        const footer = `

Homepage: https://dlb-sukuk.22web.org`;

        const message = userIsAdmin ? baseMessage + adminCommands + footer : baseMessage + footer;
        
        bot.sendMessage(chatId, message);
    });
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
