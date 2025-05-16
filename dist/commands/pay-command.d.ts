import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand, AdminCommand } from './base-command';
/**
 * Command to submit payment transactions
 */
export declare class PayNowCommand extends BaseCommand {
    constructor();
    execute(msg: TelegramBot.Message, args?: string[]): Promise<void>;
}
/**
 * Command to view pending transactions (admin only)
 */
export declare class PendingPaymentsCommand extends AdminCommand {
    constructor();
    executeAdmin(msg: TelegramBot.Message, _args?: string[]): Promise<void>;
}
/**
 * Abstract base class for payment action commands
 */
export declare abstract class PaymentActionCommand extends AdminCommand {
    protected processPaymentAction(msg: TelegramBot.Message, args: string[] | undefined, action: 'approved' | 'rejected'): Promise<void>;
}
/**
 * Command to approve a transaction (admin only)
 */
export declare class ApprovePaymentCommand extends PaymentActionCommand {
    constructor();
    executeAdmin(msg: TelegramBot.Message, _args?: string[]): Promise<void>;
}
/**
 * Command to reject a transaction (admin only)
 */
export declare class RejectPaymentCommand extends PaymentActionCommand {
    constructor();
    executeAdmin(msg: TelegramBot.Message, _args?: string[]): Promise<void>;
}
