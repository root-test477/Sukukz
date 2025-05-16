import { BaseCommand } from './base-command';
import TelegramBot from 'node-telegram-bot-api';
/**
 * Command to provide help and feature recommendations to users
 */
export declare class InfoCommand extends BaseCommand {
    constructor();
    protected executeCommand(msg: TelegramBot.Message): Promise<void>;
}
