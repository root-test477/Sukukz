import TelegramBot from 'node-telegram-bot-api';
import { AdminCommand } from './base-command';
/**
 * Admin command for viewing error reports
 */
export declare class ErrorsCommand extends AdminCommand {
    constructor();
    executeAdmin(msg: TelegramBot.Message, _args?: string[]): Promise<void>;
}
