import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand } from './base-command';
/**
 * Command to display bot information and help
 */
export declare class InfoCommand extends BaseCommand {
    constructor();
    execute(msg: TelegramBot.Message, _args?: string[]): Promise<void>;
}
