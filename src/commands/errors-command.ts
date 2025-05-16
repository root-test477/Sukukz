import TelegramBot from 'node-telegram-bot-api';
import { AdminCommand } from './base-command';
import { handleErrorsCommand } from '../error-handler';

/**
 * Admin command for viewing error reports
 */
export class ErrorsCommand extends AdminCommand {
    constructor() {
        super('errors', 'View recent error reports');
    }
    
    async executeAdmin(msg: TelegramBot.Message): Promise<void> {
        // Delegate to the handler in error-handler.ts
        await handleErrorsCommand(msg);
    }
}
