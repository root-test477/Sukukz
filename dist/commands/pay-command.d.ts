import { BaseCommand } from './base-command';
import TelegramBot from 'node-telegram-bot-api';
/**
 * Command for submitting transactions for approval
 */
export declare class PayNowCommand extends BaseCommand {
    constructor();
    protected executeCommand(msg: TelegramBot.Message): Promise<void>;
    /**
     * Start the payment submission process
     */
    private startPaymentSubmission;
    /**
     * Process the transaction submission
     */
    private processTransactionSubmission;
    /**
     * Notify admins about a new payment request
     */
    private notifyAdminsNewPayment;
}
/**
 * Command for admins to list pending payment requests
 */
export declare class PendingPaymentsCommand extends BaseCommand {
    constructor();
    protected executeCommand(msg: TelegramBot.Message): Promise<void>;
}
/**
 * Base class for approve/reject commands
 */
declare abstract class PaymentActionCommand extends BaseCommand {
    protected action: 'approve' | 'reject';
    constructor(commandName: string, description: string, action: 'approve' | 'reject');
    protected executeCommand(msg: TelegramBot.Message): Promise<void>;
    /**
     * Process payment approval or rejection
     */
    private processPaymentAction;
    /**
     * Notify the user about their payment status
     */
    private notifyUser;
}
/**
 * Command for admins to approve payment requests
 */
export declare class ApprovePaymentCommand extends PaymentActionCommand {
    constructor();
}
/**
 * Command for admins to reject payment requests
 */
export declare class RejectPaymentCommand extends PaymentActionCommand {
    constructor();
}
export {};
