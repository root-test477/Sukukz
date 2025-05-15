import TelegramBot from 'node-telegram-bot-api';
/**
 * Tutorial Steps Interface
 */
export interface TutorialStep {
    id: string;
    message: string;
    options?: TelegramBot.InlineKeyboardButton[][];
    nextStep?: string;
    isCompleted?: (msg: TelegramBot.Message | TelegramBot.CallbackQuery) => boolean;
}
/**
 * User Progress Interface
 */
export interface TutorialProgress {
    userId: number;
    currentStep: string;
    completedSteps: string[];
    startTime: number;
    lastActivity: number;
}
/**
 * Manages interactive tutorials for users
 */
export declare class Tutorial {
    private static readonly TUTORIAL_CALLBACK_PREFIX;
    private static readonly WALLET_TUTORIAL;
    private static readonly TRANSACTION_TUTORIAL;
    private static readonly GENERAL_TUTORIAL;
    private static userProgress;
    /**
     * Start a tutorial for a user
     */
    static startTutorial(chatId: number, tutorialType: string): Promise<void>;
    /**
     * Handle tutorial callback queries
     */
    static handleTutorialCallback(query: TelegramBot.CallbackQuery): Promise<void>;
    /**
     * Show the current tutorial step to the user
     */
    private static showCurrentStep;
    /**
     * Get tutorial step definition
     */
    private static getTutorialStep;
}
/**
 * Handle /tutorial command
 */
export declare function handleTutorialCommand(msg: TelegramBot.Message): Promise<void>;
/**
 * Handle tutorial type selection
 */
export declare function handleTutorialTypeCallback(query: TelegramBot.CallbackQuery): Promise<void>;
