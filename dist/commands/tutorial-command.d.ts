import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand } from './base-command';
/**
 * Command to start the interactive tutorial
 */
export declare class TutorialCommand extends BaseCommand {
    constructor();
    execute(msg: TelegramBot.Message, _args?: string[]): Promise<void>;
}
/**
 * Command to skip the tutorial
 */
export declare class SkipTutorialCommand extends BaseCommand {
    constructor();
    execute(msg: TelegramBot.Message, _args?: string[]): Promise<void>;
}
