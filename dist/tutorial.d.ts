import TelegramBot from 'node-telegram-bot-api';
export declare enum TutorialStep {
    WELCOME = 0,
    CONNECT_WALLET = 1,
    CHECK_WALLET = 2,
    SEND_TRANSACTION = 3,
    SUBMIT_TRANSACTION_ID = 4,
    COMPLETED = 5
}
export interface TutorialUserData {
    chatId: number;
    currentStep: TutorialStep;
    started: number;
    lastActivity: number;
    completed: boolean;
    skipped: boolean;
}
/**
 * Tutorial state management
 */
export declare class TutorialManager {
    private static readonly REDIS_TUTORIAL_KEY;
    private static readonly DEBUG;
    /**
     * Get tutorial progress for a user
     * @param chatId User's chat ID
     * @returns Tutorial progress data or null if not found
     */
    static getTutorialProgress(chatId: number): Promise<TutorialUserData | null>;
    /**
     * Save tutorial progress for a user
     * @param data Tutorial progress data
     */
    static saveTutorialProgress(data: TutorialUserData): Promise<void>;
    /**
     * Start or resume the tutorial for a user
     * @param chatId User's chat ID
     * @returns Current tutorial step
     */
    static startOrResumeTutorial(chatId: number): Promise<TutorialStep>;
    /**
     * Advance to the next tutorial step
     * @param chatId User's chat ID
     * @returns New tutorial step or null if error
     */
    static advanceToNextStep(chatId: number): Promise<TutorialStep | null>;
    /**
     * Skip the tutorial
     * @param chatId User's chat ID
     */
    static skipTutorial(chatId: number): Promise<void>;
    /**
     * Check if the user is eligible for tutorial suggestion
     * (new users who haven't completed, skipped, or started the tutorial)
     * @param chatId User's chat ID
     */
    static shouldSuggestTutorial(chatId: number): Promise<boolean>;
    /**
     * Check if tutorial step is completed
     * @param chatId User's chat ID
     * @param step The step to check
     */
    static checkStepCompleted(chatId: number, step: TutorialStep): Promise<boolean>;
}
/**
 * Handle the /tutorial command
 * @param msg Telegram message object
 */
export declare function handleTutorialCommand(msg: TelegramBot.Message): Promise<void>;
/**
 * Handle the /skip command
 * @param msg Telegram message object
 */
export declare function handleSkipCommand(msg: TelegramBot.Message): Promise<void>;
/**
 * Check if a step is completed and possibly advance tutorial
 * @param chatId User's chat ID
 * @param step The step that was completed
 */
export declare function checkAndAdvanceTutorial(chatId: number, step: TutorialStep): Promise<void>;
/**
 * Auto-suggest tutorial to new users
 * @param chatId User's chat ID
 */
export declare function autoSuggestTutorial(chatId: number): Promise<void>;
/**
 * Handle tutorial callbacks
 * @param query Callback query
 */
export declare function handleTutorialCallback(query: TelegramBot.CallbackQuery, _data: string): Promise<void>;
