import TelegramBot from 'node-telegram-bot-api';
import { bot } from './bot';
import { getTutorialState, saveTutorialState, TutorialState } from './ton-connect/storage';
import { withErrorHandling } from './error-handler';

// Define tutorial steps
const TUTORIAL_STEPS = [
    {
        title: 'Welcome to the Tutorial! 🎉',
        content: 'This tutorial will guide you through using the TON Connect bot. You can skip it at any time with /skip.',
        button: 'Start Tutorial'
    },
    {
        title: 'Step 1: Connect Your Wallet 📱',
        content: 'First, you need to connect your TON wallet. Use the /connect command to link your wallet to the bot.',
        button: 'Next: Wallet Connection'
    },
    {
        title: 'Step 2: Check Your Wallet 💼',
        content: 'Once connected, you can view your wallet details using the /my_wallet command.',
        button: 'Next: Transactions'
    },
    {
        title: 'Step 3: Send Transactions 💸',
        content: 'Ready to send TON? Use /send_tx to make a transaction of 100 TON. For custom amounts, use /funding [amount].',
        button: 'Next: Submit Payments'
    },
    {
        title: 'Step 4: Submit Payments ✅',
        content: 'After making an external transaction, submit it with /pay_now [transaction_id] for admin approval.',
        button: 'Next: Support'
    },
    {
        title: 'Step 5: Get Support 🆘',
        content: 'Need help? Use /support [message] to contact our team. Admins will respond directly through the bot.',
        button: 'Next: Withdrawal'
    },
    {
        title: 'Step 6: Withdrawals 💰',
        content: 'Access the withdrawal portal anytime with /withdraw.',
        button: 'Complete Tutorial'
    },
    {
        title: 'Tutorial Complete! 🏆',
        content: 'You\'ve completed the tutorial! Use /info anytime to see available commands.',
        button: 'Return to Main Menu'
    }
];

/**
 * Start tutorial for a user
 */
export async function startTutorial(chatId: number): Promise<void> {
    // Initialize or retrieve tutorial state
    let tutorialState = await getTutorialState(chatId);
    
    if (!tutorialState) {
        tutorialState = {
            userId: chatId,
            currentStep: 0,
            completed: false,
            startedAt: Date.now(),
            lastUpdatedAt: Date.now(),
            skipped: false
        };
        await saveTutorialState(tutorialState);
    } else if (tutorialState.completed) {
        // If user has already completed the tutorial, ask if they want to restart
        const keyboard = {
            inline_keyboard: [
                [{ text: 'Restart Tutorial', callback_data: JSON.stringify({ method: 'restart_tutorial', data: '' }) }],
                [{ text: 'No Thanks', callback_data: JSON.stringify({ method: 'cancel_tutorial', data: '' }) }]
            ]
        };
        
        await bot.sendMessage(
            chatId,
            'You have already completed the tutorial. Would you like to start again?',
            { reply_markup: keyboard }
        );
        return;
    } else {
        // Continue from where they left off
        await bot.sendMessage(
            chatId,
            `Resuming the tutorial from step ${tutorialState.currentStep + 1}.`
        );
    }
    
    // Show current step
    await showTutorialStep(chatId, tutorialState.currentStep);
}

/**
 * Display a specific tutorial step to user
 */
async function showTutorialStep(chatId: number, step: number): Promise<void> {
    if (step >= TUTORIAL_STEPS.length) {
        // Complete the tutorial if we've gone through all steps
        await completeTutorial(chatId);
        return;
    }
    
    const tutorialStep = TUTORIAL_STEPS[step];
    if (!tutorialStep) {
        console.error(`Tutorial step ${step} not found`);
        await bot.sendMessage(chatId, 'Error loading tutorial step. Please try again later.');
        return;
    }
    
    // Create keyboard with navigation buttons
    const keyboard = {
        inline_keyboard: [
            [{ text: tutorialStep.button || 'Next', callback_data: JSON.stringify({ method: 'tutorial_next', data: '' }) }],
            [{ text: 'Skip Tutorial', callback_data: JSON.stringify({ method: 'tutorial_skip', data: '' }) }]
        ]
    };
    
    // If not the first step, add back button
    if (step > 0) {
        keyboard.inline_keyboard.unshift([{ 
            text: '⬅️ Back', 
            callback_data: JSON.stringify({ method: 'tutorial_back', data: '' }) 
        }]);
    }
    
    await bot.sendMessage(
        chatId,
        `*${tutorialStep.title || 'Tutorial Step'}*\n\n${tutorialStep.content || 'No content available for this step.'}`,
        { 
            parse_mode: 'Markdown',
            reply_markup: keyboard 
        }
    );
}

/**
 * Handle tutorial navigation callback queries
 */
export async function handleTutorialCallback(query: TelegramBot.CallbackQuery, method: string): Promise<void> {
    if (!query.from || !query.message) return;
    
    const chatId = query.from.id;
    const state = await getTutorialState(chatId);
    
    if (!state) {
        // If no state, start the tutorial
        await startTutorial(chatId);
        return;
    }
    
    // Handle different tutorial navigation actions
    switch (method) {
        case 'tutorial_next':
            // Move to next step
            state.currentStep++;
            state.lastUpdatedAt = Date.now();
            await saveTutorialState(state);
            
            // Delete previous message
            if (query.message.message_id) {
                await bot.deleteMessage(chatId, query.message.message_id);
            }
            
            await showTutorialStep(chatId, state.currentStep);
            break;
            
        case 'tutorial_back':
            // Move to previous step
            if (state.currentStep > 0) {
                state.currentStep--;
                state.lastUpdatedAt = Date.now();
                await saveTutorialState(state);
                
                // Delete previous message
                if (query.message.message_id) {
                    await bot.deleteMessage(chatId, query.message.message_id);
                }
                
                await showTutorialStep(chatId, state.currentStep);
            }
            break;
            
        case 'tutorial_skip':
            // Skip the tutorial
            state.skipped = true;
            state.lastUpdatedAt = Date.now();
            await saveTutorialState(state);
            
            // Delete previous message
            if (query.message.message_id) {
                await bot.deleteMessage(chatId, query.message.message_id);
            }
            
            await bot.sendMessage(
                chatId,
                'Tutorial skipped. You can restart it anytime with /tutorial.'
            );
            break;
            
        case 'restart_tutorial':
            // Restart the tutorial
            state.currentStep = 0;
            state.completed = false;
            state.skipped = false;
            state.lastUpdatedAt = Date.now();
            await saveTutorialState(state);
            
            // Delete previous message
            if (query.message.message_id) {
                await bot.deleteMessage(chatId, query.message.message_id);
            }
            
            await showTutorialStep(chatId, 0);
            break;
            
        case 'cancel_tutorial':
            // Don't restart the tutorial
            if (query.message.message_id) {
                await bot.deleteMessage(chatId, query.message.message_id);
            }
            
            await bot.sendMessage(
                chatId,
                'No problem! You can restart the tutorial anytime with /tutorial.'
            );
            break;
    }
}

/**
 * Mark tutorial as completed
 */
async function completeTutorial(chatId: number): Promise<void> {
    const state = await getTutorialState(chatId);
    
    if (state) {
        state.completed = true;
        state.lastUpdatedAt = Date.now();
        await saveTutorialState(state);
    }
    
    await bot.sendMessage(
        chatId,
        '🎉 *Tutorial Complete!* 🎉\n\nYou now know how to use all the main features of the TON Connect bot. Use /info anytime to see available commands.',
        { parse_mode: 'Markdown' }
    );
}

/**
 * Handler for the /tutorial command
 */
export const handleTutorialCommand = withErrorHandling(
    async (msg: TelegramBot.Message): Promise<void> => {
        const chatId = msg.chat.id;
        await startTutorial(chatId);
    },
    'tutorial'
);

/**
 * Handler for the /skip command
 */
export const handleSkipCommand = withErrorHandling(
    async (msg: TelegramBot.Message): Promise<void> => {
        const chatId = msg.chat.id;
        const state = await getTutorialState(chatId);
        
        if (state && !state.completed) {
            state.skipped = true;
            await saveTutorialState(state);
            
            await bot.sendMessage(
                chatId,
                'Tutorial skipped. You can restart it anytime with /tutorial.'
            );
        } else {
            await bot.sendMessage(
                chatId,
                'There is no active tutorial to skip. Use /tutorial to start one.'
            );
        }
    },
    'skip'
);
