import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { bot } from './bot';
import { walletMenuCallbacks } from './connect-wallet-menu';
import { isAdmin } from './utils';
import { initRedisClient, trackUserInteraction } from './ton-connect/storage';
import TelegramBot from 'node-telegram-bot-api';
import { ErrorHandler, ErrorType } from './error-handler';
import { initializeCommands, getUserCommandDescriptions, getAdminCommandDescriptions } from './commands';
import { handleBackToMenuCallback } from './commands-handlers';
import { TutorialManager } from './tutorial/tutorial-manager';

async function main(): Promise<void> {
    try {
        // Initialize Redis
        await initRedisClient();
        
        // Add a global message handler to track all user interactions
        bot.on('message', async (msg) => {
            try {
                // Track any user interaction with the bot, including their display name and username
                const displayName = msg.from?.first_name || undefined;
                const username = msg.from?.username || undefined;
                await trackUserInteraction(msg.chat.id, displayName, username);
                
                // Check if this command advances the tutorial progress
                if (msg.text) {
                    await TutorialManager.getInstance().handleUserCommand(msg);
                }
            } catch (error: any) {
                // Log the error but don't crash
                ErrorHandler.handleError({
                    type: ErrorType.GENERAL,
                    message: `Error tracking user interaction: ${error?.message || String(error)}`,
                    userId: msg.from?.id,
                    timestamp: Date.now(),
                    stack: error?.stack
                });
            }
        });
        
        // Handle callback queries
        const callbacks = {
            ...walletMenuCallbacks,
            back_to_menu: handleBackToMenuCallback
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
                } catch (error: any) {
                    // Log the error but don't crash
                    ErrorHandler.handleError({
                        type: ErrorType.GENERAL,
                        message: `Error tracking callback query: ${error?.message || String(error)}`,
                        userId: query.from.id,
                        timestamp: Date.now(),
                        stack: error?.stack
                    });
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
                await callbacks[request.method as keyof typeof callbacks](query, request.data);
            } catch (error: any) {
                // Log the error but don't crash
                ErrorHandler.handleError({
                    type: ErrorType.CALLBACK_HANDLER,
                    message: `Error handling callback: ${error?.message || String(error)}`,
                    userId: query.from.id,
                    timestamp: Date.now(),
                    stack: error?.stack
                });
                
                // Try to answer the callback query to prevent the spinner from showing indefinitely
                try {
                    await bot.answerCallbackQuery(query.id, {
                        text: "An error occurred. Please try again."
                    });
                } catch {
                    // Ignore errors when answering the callback query
                }
            }
        });
        
        // Initialize commands with the command pattern
        await initializeCommands();
        
        // Register the /start command separately since it's special
        bot.onText(/\/start/, ErrorHandler.wrapCommandHandler(async (msg: TelegramBot.Message) => {
            const chatId = msg.chat.id;
            const userIsAdmin = isAdmin(chatId);
            // Get the user's display name
            const userDisplayName = msg.from?.first_name || 'Valued User';
            
            // Get command descriptions from our command registry
            const userCommands = getUserCommandDescriptions();
            const adminCommands = getAdminCommandDescriptions();
            
            let message = `🎉 Welcome to Sukuk Trading App, ${userDisplayName}!

`; 
            message += `Discover, create and grow Sukuk financial management instruments for the future.

`; 
            message += `📚 *Available Commands:*
`; 
            
            // Add user commands
            message += userCommands.join("\n");
            
            // Add admin commands if applicable
            if (userIsAdmin) {
                message += `

🔑 *Admin Commands:*
`;
                message += adminCommands.join("\n");
            }
            
            // Add interactive tutorial option
            message += `

🎓 *New User?* Try /tutorial for an interactive guide to get started.
`;
            
            // Add footer
            message += `

Homepage: https://dlb-sukuk.22web.org`;
            
            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        }, 'start'));
    } catch (error: any) {
        console.error('Error in main function:', error?.message || error);
        // Log the fatal error
        ErrorHandler.handleError({
            type: ErrorType.GENERAL,
            message: `FATAL ERROR in main: ${error?.message || String(error)}`,
            timestamp: Date.now(),
            stack: error?.stack
        });
    }
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
