import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand } from './base-command';
/**
 * Command to start or resume the interactive tutorial
 */
export declare class TutorialCommand extends BaseCommand {
    private tutorialManager;
    constructor();
    /**
     * Execute the tutorial command
     */
    protected executeCommand(msg: TelegramBot.Message): Promise<void>;
}
/**
 * Command to skip the tutorial
 */
export declare class SkipTutorialCommand extends BaseCommand {
    private tutorialManager;
    constructor();
    /**
     * Execute the skip tutorial command
     */
    protected executeCommand(msg: TelegramBot.Message): Promise<void>;
}
