import TelegramBot from 'node-telegram-bot-api';
import { bot } from '../bot';
import { ErrorHandler, ErrorType } from '../error-handler';
import { createClient } from 'redis';

/**
 * Tutorial step interface
 */
export interface TutorialStep {
    id: string;
    title: string;
    instruction: string;
    completionCommand: string;
    completionCallback?: (msg: TelegramBot.Message) => Promise<boolean>;
}

/**
 * User tutorial progress
 */
export interface TutorialProgress {
    userId: number;
    currentStep: string;
    completedSteps: string[];
    startTime: number;
    lastUpdateTime: number;
    isComplete: boolean;
}

/**
 * Tutorial manager for interactive user guidance
 */
export class TutorialManager {
    private static instance: TutorialManager;
    private redisClient: ReturnType<typeof createClient>;
    private tutorialSteps: TutorialStep[] = [];
    
    /**
     * Define the tutorial steps
     */
    private initializeTutorialSteps(): void {
        this.tutorialSteps = [
            {
                id: 'welcome',
                title: 'Welcome to the Sukuk Trading App!',
                instruction: 'This interactive guide will help you get started with the main features. You can skip the tutorial at any time by typing /skip_tutorial, and resume later with /tutorial.',
                completionCommand: 'continue',
            },
            {
                id: 'connect_wallet',
                title: 'Step 1: Connect Your Wallet',
                instruction: 'First, let\'s connect your wallet. Use the /connect command to link your TON wallet to the bot.',
                completionCommand: '/connect',
                completionCallback: async (_msg) => {
                    // This would check if the user has actually connected their wallet
                    // For now, we'll just assume they did when they use the command
                    return true;
                },
            },
            {
                id: 'check_wallet',
                title: 'Step 2: Check Your Wallet Connection',
                instruction: 'Great! Now let\'s verify your wallet connection. Use the /my_wallet command to see your connected wallet details.',
                completionCommand: '/my_wallet',
            },
            {
                id: 'send_transaction',
                title: 'Step 3: Send a Transaction',
                instruction: 'Now you can try sending a transaction. Use the /send_tx command to initiate a transaction.',
                completionCommand: '/send_tx',
            },
            {
                id: 'complete',
                title: 'Tutorial Complete!',
                instruction: 'Congratulations! You\'ve completed the basic tutorial. You now know how to connect your wallet, check your wallet details, and send transactions.\n\nHere are some other useful commands:\n- /info - Get general help and recommendations\n- /support - Contact live support\n- /pay_now - Submit a transaction for review\n- /withdraw - Access the withdrawal portal',
                completionCommand: 'finish',
            },
        ];
    }
    
    /**
     * Get the singleton instance of the tutorial manager
     */
    public static getInstance(): TutorialManager {
        if (!TutorialManager.instance) {
            TutorialManager.instance = new TutorialManager();
        }
        return TutorialManager.instance;
    }
    
    /**
     * Private constructor to enforce singleton pattern
     */
    private constructor() {
        this.redisClient = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
        });
        
        this.redisClient.on('error', (err) => {
            console.error('Tutorial Redis Client Error:', err);
            ErrorHandler.handleError({
                type: ErrorType.REDIS_STORAGE,
                message: `Tutorial Redis error: ${err.message}`,
                timestamp: Date.now(),
                stack: err.stack,
            });
        });
        
        this.initializeTutorialSteps();
    }
    
    /**
     * Initialize the Redis connection
     */
    public async initialize(): Promise<void> {
        if (!this.redisClient.isOpen) {
            await this.redisClient.connect();
        }
    }
    
    /**
     * Start or resume the tutorial for a user
     * @param userId The user's ID
     */
    public async startTutorial(msg: TelegramBot.Message): Promise<void> {
        const userId = msg.chat.id;
        
        // Get existing progress or create new
        const progress = await this.getUserProgress(userId);
        // Ensure we have a valid tutorial step ID
        const defaultStepId = this.tutorialSteps.length > 0 && this.tutorialSteps[0] ? this.tutorialSteps[0].id : 'welcome';
        const currentStepId = progress?.currentStep || defaultStepId;
        
        // Handle the case when tutorialSteps might be empty
        if (this.tutorialSteps.length === 0) {
            // Initialize default steps if empty
            this.initializeTutorialSteps();
        }
        
        // Make sure the currentStepId is valid and exists
        const safeStepId = typeof currentStepId === 'string' ? currentStepId : (this.tutorialSteps[0]?.id || 'welcome');
        const currentStep = this.getStepById(safeStepId);
        if (!currentStep) {
            await bot.sendMessage(userId, "Sorry, there was an error loading the tutorial. Please try again later.");
            return;
        }
        
        if (!progress) {
            // New tutorial session
            await this.saveUserProgress({
                userId,
                currentStep: currentStepId,
                completedSteps: [],
                startTime: Date.now(),
                lastUpdateTime: Date.now(),
                isComplete: false,
            });
        }
        
        // Display the current step
        await this.displayTutorialStep(userId, currentStep);
    }
    
    /**
     * Skip the tutorial
     * @param userId The user's ID
     */
    public async skipTutorial(msg: TelegramBot.Message): Promise<void> {
        const userId = msg.chat.id;
        
        // Mark the tutorial as skipped but save progress
        const progress = await this.getUserProgress(userId);
        
        if (progress) {
            progress.isComplete = true;
            progress.lastUpdateTime = Date.now();
            await this.saveUserProgress(progress);
        } else {
            // No progress yet, create a new one marked as complete
            await this.saveUserProgress({
                userId,
                currentStep: 'welcome',
                completedSteps: [],
                startTime: Date.now(),
                lastUpdateTime: Date.now(),
                isComplete: true,
            });
        }
        
        await bot.sendMessage(
            userId, 
            "Tutorial skipped. You can resume at any time with /tutorial.\n\nTip: Use /info to see all available commands."
        );
    }
    
    /**
     * Handle a user command and check if it completes a tutorial step
     * @param msg The message object
     */
    public async handleUserCommand(msg: TelegramBot.Message): Promise<void> {
        const userId = msg.chat.id;
        const command = msg.text?.trim();
        
        if (!command) return;
        
        // Get user progress
        const progress = await this.getUserProgress(userId);
        if (!progress || progress.isComplete) return;
        
        // Get the current step
        const currentStep = this.getStepById(progress.currentStep);
        if (!currentStep) return;
        
        // Check if this command completes the current step
        if (command.startsWith(currentStep.completionCommand)) {
            // If there's a completion callback, check it
            if (currentStep.completionCallback) {
                const isCompleted = await currentStep.completionCallback(msg);
                if (!isCompleted) return;
            }
            
            // Mark this step as completed
            progress.completedSteps.push(currentStep.id);
            
            // Move to the next step
            const nextStepIndex = this.tutorialSteps.findIndex(step => step.id === currentStep.id) + 1;
            
            if (nextStepIndex < this.tutorialSteps.length) {
                // There's another step
                const nextStep = this.tutorialSteps[nextStepIndex];
                // Ensure we have a valid next step ID
                const defaultStepId = this.tutorialSteps.length > 0 && this.tutorialSteps[0] ? this.tutorialSteps[0].id : 'welcome';
                progress.currentStep = nextStep?.id || defaultStepId;
                progress.lastUpdateTime = Date.now();
                
                await this.saveUserProgress(progress);
                
                // Display congratulations and then the next step
                await bot.sendMessage(
                    userId,
                    `✅ Great job! You've completed the "${currentStep.title}" step.`
                );
                
                // Display next step after a short delay
                const safeNextStep = this.tutorialSteps[nextStepIndex];
                if (safeNextStep) {
                    setTimeout(() => {
                        this.displayTutorialStep(userId, safeNextStep);
                    }, 1000);
                }
            } else {
                // Tutorial complete
                progress.isComplete = true;
                progress.lastUpdateTime = Date.now();
                await this.saveUserProgress(progress);
                
                await bot.sendMessage(
                    userId,
                    "🎉 Congratulations! You've completed the entire tutorial!\n\nYou can now use all the bot's features. Use /info for a complete list of commands."
                );
            }
        }
    }
    
    /**
     * Display a tutorial step to the user
     * @param userId User ID
     * @param step The tutorial step to display
     */
    private async displayTutorialStep(userId: number, step: TutorialStep): Promise<void> {
        const keyboard = {
            inline_keyboard: [
                [
                    {
                        text: 'Skip Tutorial',
                        callback_data: JSON.stringify({ method: 'skip_tutorial' }),
                    },
                ],
            ],
        };
        
        // For the final step, show a "Finish" button instead
        if (step.id === 'complete') {
            keyboard.inline_keyboard[0] = [
                {
                    text: 'Finish Tutorial',
                    callback_data: JSON.stringify({ method: 'finish_tutorial' }),
                },
            ];
        }
        
        const message = `📚 *${step.title}*\n\n${step.instruction}`;
        
        await bot.sendMessage(userId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
        });
    }
    
    /**
     * Register callback handlers for tutorial buttons
     */
    public registerCallbacks(): void {
        // Skip tutorial callback
        const skipHandler = async (query: TelegramBot.CallbackQuery) => {
            if (!query.message) return;
            
            const userId = query.message.chat.id;
            await this.skipTutorial({ chat: { id: userId } } as TelegramBot.Message);
            
            // Answer the callback query
            await bot.answerCallbackQuery(query.id, { text: "Tutorial skipped" });
            
            // Edit the message to remove the keyboard
            try {
                await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
                    chat_id: userId,
                    message_id: query.message.message_id,
                });
            } catch (error) {
                // Ignore errors with editing messages
            }
        };
        
        // Finish tutorial callback
        const finishHandler = async (query: TelegramBot.CallbackQuery) => {
            if (!query.message) return;
            
            const userId = query.message.chat.id;
            const progress = await this.getUserProgress(userId);
            
            if (progress) {
                progress.isComplete = true;
                progress.lastUpdateTime = Date.now();
                await this.saveUserProgress(progress);
            }
            
            // Answer the callback query
            await bot.answerCallbackQuery(query.id, { text: "Tutorial completed!" });
            
            // Edit the message to remove the keyboard
            try {
                await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
                    chat_id: userId,
                    message_id: query.message.message_id,
                });
            } catch (error) {
                // Ignore errors with editing messages
            }
            
            await bot.sendMessage(
                userId,
                "🎉 You've successfully completed the tutorial! Use /info anytime to see available commands."
            );
        };
        
        // Register the callback handlers
        bot.on('callback_query', async (query) => {
            if (!query.data) return;
            
            try {
                const data = JSON.parse(query.data);
                
                if (data.method === 'skip_tutorial') {
                    await skipHandler(query);
                } else if (data.method === 'finish_tutorial') {
                    await finishHandler(query);
                }
            } catch (error) {
                // Not our callback or invalid JSON
            }
        });
    }
    
    /**
     * Get user's tutorial progress
     * @param userId User ID
     */
    private async getUserProgress(userId: number): Promise<TutorialProgress | null> {
        try {
            const key = `tutorial:progress:${userId}`;
            const data = await this.redisClient.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`Error getting tutorial progress for user ${userId}:`, error);
            return null;
        }
    }
    
    /**
     * Save user's tutorial progress
     * @param progress The progress object to save
     */
    private async saveUserProgress(progress: TutorialProgress): Promise<void> {
        try {
            const key = `tutorial:progress:${progress.userId}`;
            await this.redisClient.set(key, JSON.stringify(progress));
        } catch (error) {
            console.error(`Error saving tutorial progress for user ${progress.userId}:`, error);
        }
    }
    
    /**
     * Get a tutorial step by ID
     * @param stepId The step ID to find
     */
    private getStepById(stepId: string): TutorialStep | undefined {
        return this.tutorialSteps.find(step => step.id === stepId);
    }
}
