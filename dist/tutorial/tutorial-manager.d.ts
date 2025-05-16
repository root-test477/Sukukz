import TelegramBot from 'node-telegram-bot-api';
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
export declare class TutorialManager {
    private static instance;
    private redisClient;
    private tutorialSteps;
    /**
     * Define the tutorial steps
     */
    private initializeTutorialSteps;
    /**
     * Get the singleton instance of the tutorial manager
     */
    static getInstance(): TutorialManager;
    /**
     * Private constructor to enforce singleton pattern
     */
    private constructor();
    /**
     * Initialize the Redis connection
     */
    initialize(): Promise<void>;
    /**
     * Start or resume the tutorial for a user
     * @param userId The user's ID
     */
    startTutorial(msg: TelegramBot.Message): Promise<void>;
    /**
     * Skip the tutorial
     * @param userId The user's ID
     */
    skipTutorial(msg: TelegramBot.Message): Promise<void>;
    /**
     * Handle a user command and check if it completes a tutorial step
     * @param msg The message object
     */
    handleUserCommand(msg: TelegramBot.Message): Promise<void>;
    /**
     * Display a tutorial step to the user
     * @param userId User ID
     * @param step The tutorial step to display
     */
    private displayTutorialStep;
    /**
     * Register callback handlers for tutorial buttons
     */
    registerCallbacks(): void;
    /**
     * Get user's tutorial progress
     * @param userId User ID
     */
    private getUserProgress;
    /**
     * Save user's tutorial progress
     * @param progress The progress object to save
     */
    private saveUserProgress;
    /**
     * Get a tutorial step by ID
     * @param stepId The step ID to find
     */
    private getStepById;
}
