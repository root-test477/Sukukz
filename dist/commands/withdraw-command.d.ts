import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand } from './base-command';
/**
 * Command to handle withdrawals
 */
export declare class WithdrawCommand extends BaseCommand {
    constructor();
    execute(msg: TelegramBot.Message, _args?: string[]): Promise<void>;
}
