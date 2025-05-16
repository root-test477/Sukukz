import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand, AdminCommand } from './base-command';
import { bot } from '../bot';
import { getConnectedWallet } from '../ton-connect/connector';
import { ErrorHandler, ErrorType } from '../error-handler';
import { saveTransaction, getTransaction, getAllPendingTransactions, updateTransaction } from '../ton-connect/storage';

/**
 * Interface for transaction submissions
 */
interface TransactionSubmission {
    id: string;
    userId: number;
    txId: string;
    amount: string;
    description: string;
    status: 'pending' | 'approved' | 'rejected';
    timestamp: number;
    reviewedBy?: number;
    reviewedAt?: number;
    reviewNote?: string;
}

/**
 * Command to submit payment transactions
 */
export class PayNowCommand extends BaseCommand {
    constructor() {
        super('pay-now', 'Submit a transaction for approval');
    }
    
    async execute(msg: TelegramBot.Message, args?: string[]): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            // Check if user has a connected wallet
            const connectedWallet = await getConnectedWallet(chatId);
            
            if (!connectedWallet) {
                await bot.sendMessage(
                    chatId,
                    'You need to connect a wallet before you can submit transactions. Use /connect to connect your wallet.'
                );
                return;
            }
            
            if (!args || args.length === 0) {
                // No arguments provided, show instruction message
                await bot.sendMessage(
                    chatId,
                    '📤 *Transaction Submission* 📤\n\n' +
                    'To submit a transaction, use the following format:\n\n' +
                    '`/pay-now <tx_id> <amount> <description>`\n\n' +
                    'Example:\n`/pay-now TX123456 10.5 Payment for services`\n\n' +
                    'Your transaction will be reviewed by an admin and you will receive a notification when it\'s processed.',
                    { parse_mode: 'Markdown' }
                );
                return;
            }
            
            // Parse transaction details
            if (args.length < 3) {
                await bot.sendMessage(
                    chatId,
                    '❌ Invalid format. Please provide transaction ID, amount, and description.\n' +
                    'Example: `/pay-now TX123456 10.5 Payment for services`',
                    { parse_mode: 'Markdown' }
                );
                return;
            }
            
            const txId = args[0];
            const amount = args[1];
            const description = args.slice(2).join(' ');
            
            // Validate input
            if (!txId || !amount || !description) {
                await bot.sendMessage(
                    chatId,
                    '❌ All fields are required: transaction ID, amount, and description.'
                );
                return;
            }
            
            // Create transaction submission
            const submission: TransactionSubmission = {
                id: `tx_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                userId: chatId,
                txId,
                amount,
                description,
                status: 'pending',
                timestamp: Date.now()
            };
            
            // Save transaction submission
            await saveTransaction(submission);
            
            // Send confirmation message
            await bot.sendMessage(
                chatId,
                '✅ Transaction submitted successfully!\n\n' +
                `*Transaction ID:* ${submission.id}\n` +
                `*Amount:* ${amount} TON\n` +
                `*Description:* ${description}\n\n` +
                'Your transaction will be reviewed by an admin and you will receive a notification when it\'s processed.',
                { parse_mode: 'Markdown' }
            );
            
            // Notify admins about new transaction
            const adminIds = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim()));
            for (const adminId of adminIds) {
                if (adminId && !isNaN(adminId)) {
                    await bot.sendMessage(
                        adminId,
                        '🔔 *New Transaction Submission* 🔔\n\n' +
                        `*Transaction ID:* ${submission.id}\n` +
                        `*User ID:* ${chatId}\n` +
                        `*Amount:* ${amount} TON\n` +
                        `*Description:* ${description}\n\n` +
                        'Use `/pending` to review all pending transactions.',
                        { parse_mode: 'Markdown' }
                    );
                }
            }
        } catch (error) {
            if (error instanceof Error) {
                await ErrorHandler.handleError(error, ErrorType.COMMAND_HANDLER, {
                    commandName: 'pay-now',
                    userId: chatId,
                    message: msg.text || ''
                });
            }
            
            await bot.sendMessage(
                chatId,
                '❌ Error submitting transaction. Please try again later.'
            );
        }
    }
}

/**
 * Command to view pending transactions (admin only)
 */
export class PendingPaymentsCommand extends AdminCommand {
    constructor() {
        super('pending', 'View pending transactions');
    }
    
    async executeAdmin(msg: TelegramBot.Message, _args?: string[]): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            // Get all pending transactions
            const pendingTransactions = await getAllPendingTransactions();
            
            if (pendingTransactions.length === 0) {
                await bot.sendMessage(
                    chatId,
                    '📊 *Pending Transactions* 📊\n\n' +
                    'There are no pending transactions at this time.',
                    { parse_mode: 'Markdown' }
                );
                return;
            }
            
            // Format transactions list
            let message = '📊 *Pending Transactions* 📊\n\n';
            
            for (const tx of pendingTransactions) {
                message += `*ID:* ${tx.id}\n` +
                         `*User:* ${tx.userId}\n` +
                         `*Amount:* ${tx.amount} TON\n` +
                         `*Description:* ${tx.description}\n` +
                         `*Submitted:* ${new Date(tx.timestamp).toLocaleString()}\n\n` +
                         `To approve: /approve ${tx.id}\n` +
                         `To reject: /reject ${tx.id}\n\n` +
                         `-----------------------------------\n\n`;
            }
            
            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (error) {
            if (error instanceof Error) {
                await ErrorHandler.handleError(error, ErrorType.COMMAND_HANDLER, {
                    commandName: 'pending',
                    userId: chatId,
                    message: msg.text || ''
                });
            }
            
            await bot.sendMessage(
                chatId,
                '❌ Error fetching pending transactions. Please try again later.'
            );
        }
    }
}

/**
 * Abstract base class for payment action commands
 */
export abstract class PaymentActionCommand extends AdminCommand {
    protected async processPaymentAction(
        msg: TelegramBot.Message, 
        args: string[] | undefined, 
        action: 'approved' | 'rejected'
    ): Promise<void> {
        const chatId = msg.chat.id;
        
        if (!args || args.length === 0) {
            await bot.sendMessage(
                chatId,
                `Please provide a transaction ID to ${action === 'approved' ? 'approve' : 'reject'}.\n` +
                `Example: /${action === 'approved' ? 'approve' : 'reject'} <transaction_id>`
            );
            return;
        }
        
        const txId = args[0] || '';
        
        if (!txId) {
            await bot.sendMessage(
                chatId,
                `Please provide a valid transaction ID to ${action === 'approved' ? 'approve' : 'reject'}.`
            );
            return;
        }
        
        try {
            // Get transaction
            const transaction = await getTransaction(txId);
            
            if (!transaction) {
                await bot.sendMessage(
                    chatId,
                    '❌ Transaction not found. Please check the ID and try again.'
                );
                return;
            }
            
            if (transaction.status !== 'pending') {
                await bot.sendMessage(
                    chatId,
                    `❌ This transaction has already been ${transaction.status}. No action taken.`
                );
                return;
            }
            
            // Update transaction status
            transaction.status = action;
            transaction.reviewedBy = chatId;
            transaction.reviewedAt = Date.now();
            transaction.reviewNote = args.length > 1 ? args.slice(1).join(' ') : '';
            
            await updateTransaction(transaction);
            
            // Notify user about transaction status
            await bot.sendMessage(
                transaction.userId,
                `${action === 'approved' ? '✅' : '❌'} Your transaction ${transaction.id} has been ${action}.\n\n` +
                `*Amount:* ${transaction.amount} TON\n` +
                `*Description:* ${transaction.description}\n` +
                (transaction.reviewNote ? `*Note:* ${transaction.reviewNote}\n` : ''),
                { parse_mode: 'Markdown' }
            );
            
            // Confirm to admin
            await bot.sendMessage(
                chatId,
                `✅ Transaction ${transaction.id} has been marked as ${action}.\n\n` +
                `Notification sent to user ${transaction.userId}.`
            );
        } catch (error) {
            if (error instanceof Error) {
                await ErrorHandler.handleError(error, ErrorType.COMMAND_HANDLER, {
                    commandName: action === 'approved' ? 'approve' : 'reject',
                    userId: chatId,
                    message: msg.text || ''
                });
            }
            
            await bot.sendMessage(
                chatId,
                `❌ Error ${action === 'approved' ? 'approving' : 'rejecting'} transaction. Please try again later.`
            );
        }
    }
}

/**
 * Command to approve a transaction (admin only)
 */
export class ApprovePaymentCommand extends PaymentActionCommand {
    constructor() {
        super('approve', 'Approve a pending transaction');
    }
    
    async executeAdmin(msg: TelegramBot.Message, _args?: string[]): Promise<void> {
        await this.processPaymentAction(msg, _args, 'approved');
    }
}

/**
 * Command to reject a transaction (admin only)
 */
export class RejectPaymentCommand extends PaymentActionCommand {
    constructor() {
        super('reject', 'Reject a pending transaction');
    }
    
    async executeAdmin(msg: TelegramBot.Message, _args?: string[]): Promise<void> {
        await this.processPaymentAction(msg, _args, 'rejected');
    }
}
