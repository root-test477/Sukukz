import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand } from './base-command';
/**
 * Command to handle user support requests and admin responses
 */
export declare class SupportCommand extends BaseCommand {
    constructor();
    execute(msg: TelegramBot.Message, args?: string[]): Promise<void>;
    /**
     * Show support dashboard to admin
     */
    private showSupportDashboard;
    /**
     * Handle admin response to a user
     */
    private handleAdminResponse;
    /**
     * Handle user support message
     */
    private handleUserMessage;
}
