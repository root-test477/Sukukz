import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand } from './base-command';
import { TutorialManager } from '../tutorial/tutorial-manager';
import { ErrorHandler, ErrorType } from '../error-handler';

/**
 * Command to start or resume the interactive tutorial
 */
export class TutorialCommand extends BaseCommand {
    private tutorialManager: TutorialManager;
    
    constructor() {
        super(
            'tutorial', // command name
            false,      // not admin-only
            'Start or resume the interactive tutorial' // description
        );
        
        this.tutorialManager = TutorialManager.getInstance();
    }
    
    /**
     * Execute the tutorial command
     */
    protected async executeCommand(msg: TelegramBot.Message): Promise<void> {
        try {
            await this.tutorialManager.startTutorial(msg);
        } catch (error: any) {
            ErrorHandler.handleError({
                type: ErrorType.COMMAND_HANDLER,
                message: `Error starting tutorial: ${error?.message || String(error)}`,
                command: this.name,
                userId: msg.from?.id,
                timestamp: Date.now(),
                stack: error?.stack
            });
            throw error; // Re-throw to let the base command error handler manage the user message
        }
    }
}

/**
 * Command to skip the tutorial
 */
export class SkipTutorialCommand extends BaseCommand {
    private tutorialManager: TutorialManager;
    
    constructor() {
        super(
            'skip_tutorial', // command name
            false,           // not admin-only
            'Skip the interactive tutorial' // description
        );
        
        this.tutorialManager = TutorialManager.getInstance();
    }
    
    /**
     * Execute the skip tutorial command
     */
    protected async executeCommand(msg: TelegramBot.Message): Promise<void> {
        try {
            await this.tutorialManager.skipTutorial(msg);
        } catch (error: any) {
            ErrorHandler.handleError({
                type: ErrorType.COMMAND_HANDLER,
                message: `Error skipping tutorial: ${error?.message || String(error)}`,
                command: this.name,
                userId: msg.from?.id,
                timestamp: Date.now(),
                stack: error?.stack
            });
            throw error; // Re-throw to let the base command error handler manage the user message
        }
    }
}
