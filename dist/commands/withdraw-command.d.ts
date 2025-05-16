import { BaseCommand } from './base-command';
import TelegramBot from 'node-telegram-bot-api';
/**
 * Command for accessing withdrawal functionality
 */
export declare class WithdrawCommand extends BaseCommand {
    constructor();
    protected executeCommand(msg: TelegramBot.Message): Promise<void>;
}
