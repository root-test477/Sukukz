import { BaseCommand } from './base-command';
import TelegramBot from 'node-telegram-bot-api';
/**
 * Command for handling user support requests
 */
export declare class SupportCommand extends BaseCommand {
    constructor();
    protected executeCommand(msg: TelegramBot.Message, _match?: RegExpExecArray | null): Promise<void>;
    /**
     * Handle support requests from regular users
     */
    private handleUserSupport;
    /**
     * Handle admin responses to support requests
     */
    private handleAdminSupport;
    /**
     * Show list of pending support requests to admin
     */
    private showPendingSupportRequests;
    /**
     * Notify all admins about a new support request
     */
    private notifyAdmins;
}
