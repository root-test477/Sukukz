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
import { withErrorBoundary, safeSendMessage } from './error-boundary';
import { handleScheduleCommand } from './scheduler';
import { 
    handleTutorialCommand, 
    handleSkipCommand, 
    handleTutorialCallback, 
    autoSuggestTutorial, 
    TutorialStep, 
    checkAndAdvanceTutorial 
} from './tutorial';

async function main(): Promise<void> {
    await initRedisClient();

    // Add global error handler for the bot
    process.on('uncaughtException', (error) => {
        console.error('UNCAUGHT EXCEPTION! Bot will continue running:', error);
    });

    process.on('unhandledRejection', (reason) => {
        console.error('UNHANDLED REJECTION! Bot will continue running:', reason);
    });

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
        // Add tutorial callbacks
        start_tutorial: (query) => handleTutorialCallback(query, 'start_tutorial'),
        skip_tutorial: (query) => handleTutorialCallback(query, 'skip_tutorial'),
        tutorial_next: (query) => handleTutorialCallback(query, 'tutorial_next'),
        // Tutorial nav buttons that execute other commands
        connect_wallet: (query: TelegramBot.CallbackQuery) => {
            if (query.message && query.message.chat) {
                // Delete the current message and run connect command
                bot.deleteMessage(query.message.chat.id, query.message.message_id)
                    .then(() => {
                        // Create a simpler approach - use handleConnectCommand properly
                        handleConnectCommand({
                            chat: query.message!.chat,
                            from: query.from,
                            text: '/connect',
                            message_id: query.message!.message_id || 0,
                            date: Math.floor(Date.now() / 1000)
                        } as TelegramBot.Message);
                    })
                    .catch(error => console.error('Error in connect_wallet callback:', error));
            }
        },
        show_wallet: (query: TelegramBot.CallbackQuery) => {
            if (query.message && query.message.chat) {
                // Run wallet check command and update tutorial progress
                handleShowMyWalletCommand({
                    chat: query.message.chat,
                    from: query.from,
                    text: '/my_wallet',
                    message_id: query.message.message_id || 0,
                    date: Math.floor(Date.now() / 1000)
                } as TelegramBot.Message)
                    .then(() => {
                        checkAndAdvanceTutorial(query.message!.chat.id, TutorialStep.CHECK_WALLET);
                    })
                    .catch(error => console.error('Error in show_wallet callback:', error));
            }
        },
        send_transaction: (query: TelegramBot.CallbackQuery) => {
            if (query.message && query.message.chat) {
                // Run transaction command and update tutorial progress
                handleSendTXCommand({
                    chat: query.message.chat,
                    from: query.from,
                    text: '/send_tx',
                    message_id: query.message.message_id || 0,
                    date: Math.floor(Date.now() / 1000)
                } as TelegramBot.Message)
                    .then(() => {
                        checkAndAdvanceTutorial(query.message!.chat.id, TutorialStep.SEND_TRANSACTION);
                    })
                    .catch(error => console.error('Error in send_transaction callback:', error));
            }
        },
        submit_transaction_id: (query: TelegramBot.CallbackQuery) => {
            if (query.message && query.message.chat) {
                // For tutorial purposes, we'll just show a sample usage of pay_now
                safeSendMessage(query.message.chat.id, 
                    '📝 *How to Submit a Transaction ID*\n\n' +
                    'To submit a real transaction ID, use this format:\n' +
                    '`/pay_now YourTransactionIDHere`\n\n' +
                    'Example with a sample transaction ID:\n' +
                    '`/pay_now EQCr7MxX-bJ-Z6kyPrpwosdfh67LT4qEujDx5rXf__mPKBjV`\n\n' +
                    'After submitting, your transaction will be reviewed by our team.',
                    { parse_mode: 'Markdown' }
                )
                .then(() => {
                    // Mark this tutorial step as completed
                    checkAndAdvanceTutorial(query.message!.chat.id, TutorialStep.SUBMIT_TRANSACTION_ID);
                })
                .catch((error: Error) => console.error('Error in submit_transaction_id callback:', error));
            }
        }
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

        try {
            console.log(`[CALLBACK] Processing callback data: ${query.data}`);
            
            // Check if the callback data is a direct method name
            if (callbacks[query.data as keyof typeof callbacks]) {
                // Direct method name (e.g., 'start_tutorial')
                console.log(`[CALLBACK] Direct callback method: ${query.data}`);
                try {
                    callbacks[query.data as keyof typeof callbacks](query, '');
                } catch (error) {
                    console.error(`[CALLBACK] Error processing direct callback method: ${query.data}`, error);
                    // Try to send an error message to the user
                    if (query.message) {
                        await bot.sendMessage(query.message.chat.id, "Sorry, there was an error processing your request.");
                    }
                }
                return;
            }
            
            // Try to parse as JSON
            try {
                const request = JSON.parse(query.data);
                console.log(`[CALLBACK] Parsed JSON request:`, request);
                
                // Check if the method exists in our callbacks
                if (!callbacks[request.method as keyof typeof callbacks]) {
                    console.error(`[CALLBACK] No handler found for method: ${request.method}`);
                    return;
                }
                
                // Execute the callback handler
                console.log(`[CALLBACK] Executing handler for method: ${request.method}`);
                callbacks[request.method as keyof typeof callbacks](query, request.data || '');
            } catch (parseError) {
                console.error(`[CALLBACK] Error parsing callback data:`, parseError);
                console.log(`[CALLBACK] Unrecognized callback format: ${query.data}`);
            }
        } catch (error) {
            console.error('Error handling callback query:', error);
            // Try to send a message to the user that something went wrong
            if (query.message) {
                try {
                    await bot.sendMessage(query.message.chat.id, "Sorry, there was an error processing your request.");
                } catch (sendError) {
                    console.error('Failed to send error message:', sendError);
                }
            }
        }
    });

    // Wrap all command handlers with error boundary
    bot.onText(/\/connect/, withErrorBoundary(async (msg) => {
        await handleConnectCommand(msg);
        // Mark the connect wallet step as completed in tutorial if user is in tutorial mode
        await checkAndAdvanceTutorial(msg.chat.id, TutorialStep.CONNECT_WALLET);
    }));

    bot.onText(/\/send_tx/, withErrorBoundary(async (msg) => {
        await handleSendTXCommand(msg);
        // Mark the send transaction step as completed in tutorial if user is in tutorial mode
        await checkAndAdvanceTutorial(msg.chat.id, TutorialStep.SEND_TRANSACTION);
    }));

    bot.onText(/\/disconnect/, withErrorBoundary(handleDisconnectCommand));

    bot.onText(/\/my_wallet/, withErrorBoundary(async (msg) => {
        await handleShowMyWalletCommand(msg);
        // Mark the check wallet step as completed in tutorial if user is in tutorial mode
        await checkAndAdvanceTutorial(msg.chat.id, TutorialStep.CHECK_WALLET);
    }));

    // Handle custom funding amount command
    bot.onText(/\/funding/, withErrorBoundary(handleFundingCommand));

    // Handle admin-only users command
    bot.onText(/\/users/, withErrorBoundary(handleUsersCommand));
    
    // Registration for new commands
    bot.onText(/\/info/, withErrorBoundary(handleInfoCommand));
    bot.onText(/\/support/, withErrorBoundary(handleSupportCommand));
    bot.onText(/\/pay_now/, withErrorBoundary(async (msg) => {
        await handlePayNowCommand(msg);
        // Mark the submit transaction ID step as completed in tutorial if user is in tutorial mode
        await checkAndAdvanceTutorial(msg.chat.id, TutorialStep.SUBMIT_TRANSACTION_ID);
    }));
    bot.onText(/\/approve/, withErrorBoundary(handleApproveCommand));
    bot.onText(/\/reject/, withErrorBoundary(handleRejectCommand));
    bot.onText(/\/withdraw/, withErrorBoundary(handleWithdrawCommand));
    
    // New scheduled messages command (admin-only)
    bot.onText(/\/schedule/, withErrorBoundary(handleScheduleCommand));
    
    // Tutorial commands
    bot.onText(/\/tutorial/, withErrorBoundary(handleTutorialCommand));
    bot.onText(/\/skip/, withErrorBoundary(handleSkipCommand));

    bot.onText(/\/start/, withErrorBoundary(async (msg: TelegramBot.Message) => {
        const chatId = msg.chat.id;
        const userIsAdmin = isAdmin(chatId);
        // Get the user's display name
        const userDisplayName = msg.from?.first_name || 'Valued User';

        // Suggest the tutorial to new users
        setTimeout(() => {
            autoSuggestTutorial(chatId).catch(error => 
                console.error('Error suggesting tutorial:', error)
            );
        }, 1000);
        
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
/tutorial - Start interactive step-by-step guide
/skip - Skip the tutorial`;

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
main();
