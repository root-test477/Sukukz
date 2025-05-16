import TelegramBot from 'node-telegram-bot-api';
import { AdminCommand } from './base-command';
/**
 * Admin command for displaying usage analytics
 */
export declare class AnalyticsCommand extends AdminCommand {
    constructor();
    executeAdmin(msg: TelegramBot.Message, _args?: string[]): Promise<void>;
}
