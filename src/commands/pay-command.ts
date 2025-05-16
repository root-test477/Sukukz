import { BaseCommand } from './base-command';
import TelegramBot from 'node-telegram-bot-api';
import { bot } from '../bot';
import { isAdmin } from '../utils';
import { createClient } from 'redis';
import { ErrorHandler, ErrorType } from '../error-handler';

// Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 10000,
    keepAlive: 10000
  }
});

redisClient.on('error', err => console.error('Redis Client Error in Payment Command:', err));

// Connect to Redis if not already connected
async function getRedisClient() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  return redisClient;
}

// Redis keys for payment system
const PAYMENT_REQUEST_KEY = 'payment:request:';
const PENDING_PAYMENTS_KEY = 'payment:pending';
const APPROVED_PAYMENTS_KEY = 'payment:approved';
const REJECTED_PAYMENTS_KEY = 'payment:rejected';

interface PaymentRequest {
  id: string; // Unique ID for the payment request
  userId: number;
  chatId: number;
  transactionId: string;
  amount?: string;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  userName?: string;
}

/**
 * Command for submitting transactions for approval
 */
export class PayNowCommand extends BaseCommand {
  constructor() {
    super('pay-now', false, 'Submit a transaction for approval');
  }

  protected async executeCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const userName = msg.from?.username || msg.from?.first_name || 'Unknown User';

    if (!userId) {
      await bot.sendMessage(chatId, '❌ Error: Could not identify user.');
      return;
    }

    // Start the payment flow
    await this.startPaymentSubmission(chatId, userId, userName);
  }

  /**
   * Start the payment submission process
   */
  private async startPaymentSubmission(
    chatId: number, 
    userId: number, 
    userName: string
  ): Promise<void> {
    const instructions = 
      `🔹 *Transaction Submission*\n\n` +
      `Please provide your transaction ID in the following format:\n\n` +
      `\`ABC123XYZ\`\n\n` +
      `This ID will be reviewed by our team for approval.`;
    
    // Send instructions with custom keyboard
    const msg = await bot.sendMessage(
      chatId, 
      instructions, 
      {
        parse_mode: 'Markdown',
        reply_markup: {
          force_reply: true,
          input_field_placeholder: 'Enter your transaction ID here',
          resize_keyboard: true,
          one_time_keyboard: true,
        }
      }
    );

    // Register a one-time listener for the reply
    const messageId = msg.message_id;
    bot.onReplyToMessage(chatId, messageId, async (replyMsg) => {
      try {
        const transactionId = replyMsg.text?.trim();
        if (!transactionId) {
          await bot.sendMessage(chatId, '❌ Transaction ID cannot be empty. Please try again with /pay-now.');
          return;
        }

        // Process the transaction ID
        await this.processTransactionSubmission(chatId, userId, userName, transactionId);
      } catch (error: any) {
        ErrorHandler.handleError({
          type: ErrorType.COMMAND_HANDLER,
          message: `Error in pay-now reply handler: ${error?.message || error}`,
          command: 'pay-now',
          userId,
          timestamp: Date.now(),
          stack: error?.stack
        });

        await bot.sendMessage(
          chatId,
          '❌ An error occurred while processing your transaction. Please try again later.'
        );
      }
    });
  }

  /**
   * Process the transaction submission
   */
  private async processTransactionSubmission(
    chatId: number,
    userId: number,
    userName: string,
    transactionId: string
  ): Promise<void> {
    // Generate a unique payment request ID
    const requestId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Create payment request object
    const paymentRequest: PaymentRequest = {
      id: requestId,
      userId,
      chatId,
      transactionId,
      timestamp: Date.now(),
      status: 'pending',
      userName
    };

    // Store in Redis
    const redis = await getRedisClient();
    await redis.set(`${PAYMENT_REQUEST_KEY}${requestId}`, JSON.stringify(paymentRequest));
    await redis.sAdd(PENDING_PAYMENTS_KEY, requestId);

    // Notify user
    await bot.sendMessage(
      chatId,
      `✅ Your transaction ID \`${transactionId}\` has been submitted for review.\n\n` +
      `Reference number: \`${requestId}\`\n\n` +
      `You will be notified once it has been processed by our team.`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 Back to Menu', callback_data: 'back_to_menu' }]
          ]
        }
      }
    );

    // Notify admins
    await this.notifyAdminsNewPayment(paymentRequest);
  }

  /**
   * Notify admins about a new payment request
   */
  private async notifyAdminsNewPayment(paymentRequest: PaymentRequest): Promise<void> {
    // Get admin IDs from environment variable
    const adminIdsEnv = process.env.ADMIN_IDS || '';
    const adminIds = adminIdsEnv.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    
    if (!adminIds.length) {
      console.warn('No admin IDs configured for payment notifications');
      return;
    }

    const notification = 
      `🔔 *New Transaction Submission*\n\n` +
      `From: ${paymentRequest.userName || 'User'} (ID: ${paymentRequest.userId})\n` +
      `Transaction ID: \`${paymentRequest.transactionId}\`\n` +
      `Reference: \`${paymentRequest.id}\`\n` +
      `Time: ${new Date(paymentRequest.timestamp).toLocaleString()}\n\n` +
      `Use /approve ${paymentRequest.id} or /reject ${paymentRequest.id} to process.`;
    
    for (const adminId of adminIds) {
      try {
        await bot.sendMessage(adminId, notification, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error(`Failed to notify admin ${adminId}:`, error);
      }
    }
  }
}

/**
 * Command for admins to list pending payment requests
 */
export class PendingPaymentsCommand extends BaseCommand {
  constructor() {
    super('pending', true, 'List pending payment requests (admin only)');
  }

  protected async executeCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const redis = await getRedisClient();

    // Get all pending payment requests
    const pendingIds = await redis.sMembers(PENDING_PAYMENTS_KEY);
    
    if (!pendingIds.length) {
      await bot.sendMessage(chatId, '✅ No pending payment requests.');
      return;
    }

    let message = `🔸 *Pending Payment Requests (${pendingIds.length}):*\n\n`;
    
    for (const requestId of pendingIds) {
      const requestData = await redis.get(`${PAYMENT_REQUEST_KEY}${requestId}`);
      if (requestData) {
        try {
          const request = JSON.parse(requestData) as PaymentRequest;
          const date = new Date(request.timestamp).toLocaleString();
          const userName = request.userName || 'User';
          
          message += `🆔 Ref: \`${request.id}\`\n`;
          message += `👤 ${userName} (ID: ${request.userId})\n`;
          message += `🧾 Transaction ID: \`${request.transactionId}\`\n`;
          message += `🕒 ${date}\n`;
          message += `✅ /approve ${request.id}\n`;
          message += `❌ /reject ${request.id}\n\n`;
        } catch (e) {
          message += `Error parsing request ${requestId}\n\n`;
        }
      }
    }

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }
}

/**
 * Base class for approve/reject commands
 */
abstract class PaymentActionCommand extends BaseCommand {
  protected action: 'approve' | 'reject';
  
  constructor(commandName: string, description: string, action: 'approve' | 'reject') {
    super(commandName, true, description);
    this.action = action;
  }

  protected async executeCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const adminId = msg.from?.id;
    
    if (!adminId) {
      await bot.sendMessage(chatId, '❌ Error: Could not identify admin user.');
      return;
    }

    // Extract payment request ID
    const requestId = msg.text?.substring(`/${this.name}`.length).trim();
    
    if (!requestId) {
      await bot.sendMessage(
        chatId, 
        `❌ Please provide a payment reference ID: /${this.name} <reference_id>`
      );
      return;
    }

    await this.processPaymentAction(chatId, adminId, requestId);
  }

  /**
   * Process payment approval or rejection
   */
  private async processPaymentAction(chatId: number, _adminId: number, requestId: string): Promise<void> {
    const redis = await getRedisClient();
    
    // Get payment request data
    const requestData = await redis.get(`${PAYMENT_REQUEST_KEY}${requestId}`);
    if (!requestData) {
      await bot.sendMessage(chatId, `❌ Payment request with ID ${requestId} not found.`);
      return;
    }

    try {
      // Parse payment request
      const request = JSON.parse(requestData) as PaymentRequest;
      
      // Check if already processed
      if (request.status !== 'pending') {
        await bot.sendMessage(
          chatId,
          `❌ This payment request has already been ${request.status}.`
        );
        return;
      }

      // Update status
      request.status = this.action === 'approve' ? 'approved' : 'rejected';
      await redis.set(`${PAYMENT_REQUEST_KEY}${requestId}`, JSON.stringify(request));
      
      // Move from pending to appropriate set
      await redis.sRem(PENDING_PAYMENTS_KEY, requestId);
      await redis.sAdd(
        this.action === 'approve' ? APPROVED_PAYMENTS_KEY : REJECTED_PAYMENTS_KEY,
        requestId
      );

      // Notify user
      await this.notifyUser(request);

      // Confirm to admin
      await bot.sendMessage(
        chatId,
        `✅ Payment ${requestId} has been ${this.action}d successfully.`
      );
    } catch (error) {
      console.error(`Error processing payment ${this.action}:`, error);
      await bot.sendMessage(
        chatId,
        `❌ An error occurred while ${this.action}ing payment ${requestId}.`
      );
    }
  }

  /**
   * Notify the user about their payment status
   */
  private async notifyUser(request: PaymentRequest): Promise<void> {
    if (!request.chatId) return;
    
    try {
      if (this.action === 'approve') {
        await bot.sendMessage(
          request.chatId,
          `✅ *Transaction Approved*\n\n` +
          `Your transaction with ID \`${request.transactionId}\` has been approved.\n` +
          `Reference: \`${request.id}\`\n\n` +
          `Thank you for using our service!`,
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🏠 Back to Menu', callback_data: 'back_to_menu' }]
              ]
            }
          }
        );
      } else {
        await bot.sendMessage(
          request.chatId,
          `❌ *Transaction Rejected*\n\n` +
          `Your transaction with ID \`${request.transactionId}\` has been rejected.\n` +
          `Reference: \`${request.id}\`\n\n` +
          `Please contact support for more information using /support.`,
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🏠 Back to Menu', callback_data: 'back_to_menu' }],
                [{ text: '📞 Contact Support', callback_data: 'contact_support' }]
              ]
            }
          }
        );
      }
    } catch (error) {
      console.error(`Failed to notify user ${request.userId}:`, error);
    }
  }
}

/**
 * Command for admins to approve payment requests
 */
export class ApprovePaymentCommand extends PaymentActionCommand {
  constructor() {
    super('approve', 'Approve a payment request (admin only)', 'approve');
  }
}

/**
 * Command for admins to reject payment requests
 */
export class RejectPaymentCommand extends PaymentActionCommand {
  constructor() {
    super('reject', 'Reject a payment request (admin only)', 'reject');
  }
}
