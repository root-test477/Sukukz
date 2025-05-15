import TelegramBot from 'node-telegram-bot-api';
import { bot } from './bot';
import { SupportedLanguage, getTranslation } from './localization';
import { isAdmin } from './utils';
import { v4 as uuidv4 } from 'uuid';

// Temporary function until storage is fully integrated
async function getUserLanguage(_chatId: number): Promise<string> {
  return 'en'; // Default to English
}

// For storing transaction submissions
interface TransactionSubmission {
  id: string;
  userId: number;
  transactionId: string;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
  adminId?: number;
  notes?: string;
}

// In-memory storage for transaction submissions (in production would use Redis)
const transactionSubmissions: Map<string, TransactionSubmission> = new Map();

/**
 * Handle the /pay_now command
 * Allows users to submit transaction IDs for admin approval
 */
export async function handlePayNowCommand(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const language = await getUserLanguage(chatId) as SupportedLanguage;
  
  // Check if user is admin or regular user
  if (isAdmin(chatId)) {
    // Admin view - show pending submissions
    await handleAdminPayNowView(chatId);
  } else {
    // User view - start submission flow
    await handleUserPayNowFlow(chatId);
  }
}

/**
 * Handle pay_now for regular users
 */
async function handleUserPayNowFlow(chatId: number): Promise<void> {
  // First message asking for transaction ID
  await bot.sendMessage(
    chatId,
    'ud83dudcb3 *Transaction Submission*\n\nPlease enter the transaction ID you would like to submit for approval. This should be a valid blockchain transaction ID.\n\nExample format: `abcdef123456789...`',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'u25c0ufe0f Back', callback_data: 'pay_now_cancel' }]
        ]
      }
    }
  );
  
  // Now we need to wait for the user's response in the message handler
  // This is handled by the main message handler with a state tracking mechanism
}

/**
 * Process transaction ID submission from user
 */
export async function processTransactionSubmission(chatId: number, transactionId: string): Promise<void> {
  // Validate transaction ID (basic check for demo)
  if (!transactionId || transactionId.length < 8) {
    await bot.sendMessage(
      chatId,
      'u274c *Invalid Transaction ID*\n\nPlease provide a valid transaction ID. It should be at least 8 characters long.',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Create a new submission
  const submissionId = uuidv4();
  const submission: TransactionSubmission = {
    id: submissionId,
    userId: chatId,
    transactionId,
    timestamp: Date.now(),
    status: 'pending'
  };
  
  // Save the submission
  transactionSubmissions.set(submissionId, submission);
  
  // Notify user
  await bot.sendMessage(
    chatId,
    `u2705 *Transaction Submitted Successfully*\n\nYour transaction ID: \`${transactionId}\`\n\nSubmission ID: \`${submissionId}\`\n\nAn administrator will review your submission shortly. You will be notified when it's approved or rejected.`,
    { parse_mode: 'Markdown' }
  );
  
  // Notify all admins about the new submission
  await notifyAdminsOfNewSubmission(submission);
}

/**
 * Handle pay_now for admins - shows pending submissions
 */
async function handleAdminPayNowView(chatId: number): Promise<void> {
  // Get all pending submissions
  const pendingSubmissions = Array.from(transactionSubmissions.values())
    .filter(sub => sub.status === 'pending')
    .sort((a, b) => a.timestamp - b.timestamp);
  
  if (pendingSubmissions.length === 0) {
    await bot.sendMessage(
      chatId,
      'ud83dudcb3 *Transaction Submissions*\n\nThere are no pending transaction submissions to review.',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Format message with pending submissions
  let message = 'ud83dudcb3 *Pending Transaction Submissions*\n\n';
  
  for (const submission of pendingSubmissions) {
    const date = new Date(submission.timestamp).toLocaleString();
    message += `*Submission ID:* \`${submission.id}\`\n`;
    message += `*Transaction ID:* \`${submission.transactionId}\`\n`;
    message += `*User ID:* \`${submission.userId}\`\n`;
    message += `*Date:* ${date}\n\n`;
    
    // Add review buttons for each submission
    message += `To approve: /approve ${submission.id}\n`;
    message += `To reject: /reject ${submission.id}\n\n`;
    message += `-------------------\n\n`;
  }
  
  await bot.sendMessage(
    chatId,
    message,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Handle the /approve command (admin-only)
 * Usage: /approve [submission_id] [optional notes]
 */
export async function handleApproveCommand(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  
  // Ensure only admins can approve
  if (!isAdmin(chatId)) {
    await bot.sendMessage(chatId, 'u26d4 This command is restricted to administrators.');
    return;
  }
  
  // Extract submission ID and notes
  const text = msg.text || '';
  const match = text.match(/\/approve\s+([\w-]+)(?:\s+(.+))?/);
  
  if (!match || !match[1]) {
    await bot.sendMessage(
      chatId,
      'u274c *Invalid Format*\n\nPlease use: /approve [submission_id] [optional notes]',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  const submissionId = match[1];
  const notes = match[2] || '';
  
  // Find the submission
  const submission = transactionSubmissions.get(submissionId);
  
  if (!submission) {
    await bot.sendMessage(
      chatId,
      `u274c *Submission Not Found*\n\nNo submission found with ID: ${submissionId}`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Update submission status
  submission.status = 'approved';
  submission.adminId = chatId;
  if (notes) submission.notes = notes;
  
  // Save updated submission
  transactionSubmissions.set(submissionId, submission);
  
  // Notify the admin
  await bot.sendMessage(
    chatId,
    `u2705 *Submission Approved*\n\nSubmission ID: \`${submissionId}\`\nTransaction ID: \`${submission.transactionId}\`\n\nThe user has been notified.`,
    { parse_mode: 'Markdown' }
  );
  
  // Notify the user
  await bot.sendMessage(
    submission.userId,
    `u2705 *Transaction Approved*\n\nYour transaction submission has been approved!\n\nSubmission ID: \`${submissionId}\`\nTransaction ID: \`${submission.transactionId}\`${notes ? `\n\nAdmin note: ${notes}` : ''}`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Handle the /reject command (admin-only)
 * Usage: /reject [submission_id] [reason]
 */
export async function handleRejectCommand(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  
  // Ensure only admins can reject
  if (!isAdmin(chatId)) {
    await bot.sendMessage(chatId, 'u26d4 This command is restricted to administrators.');
    return;
  }
  
  // Extract submission ID and reason
  const text = msg.text || '';
  const match = text.match(/\/reject\s+([\w-]+)(?:\s+(.+))?/);
  
  if (!match || !match[1]) {
    await bot.sendMessage(
      chatId,
      'u274c *Invalid Format*\n\nPlease use: /reject [submission_id] [reason]',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  const submissionId = match[1];
  const reason = match[2] || 'No reason provided';
  
  // Find the submission
  const submission = transactionSubmissions.get(submissionId);
  
  if (!submission) {
    await bot.sendMessage(
      chatId,
      `u274c *Submission Not Found*\n\nNo submission found with ID: ${submissionId}`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Update submission status
  submission.status = 'rejected';
  submission.adminId = chatId;
  submission.notes = reason;
  
  // Save updated submission
  transactionSubmissions.set(submissionId, submission);
  
  // Notify the admin
  await bot.sendMessage(
    chatId,
    `u274c *Submission Rejected*\n\nSubmission ID: \`${submissionId}\`\nTransaction ID: \`${submission.transactionId}\`\n\nThe user has been notified.`,
    { parse_mode: 'Markdown' }
  );
  
  // Notify the user
  await bot.sendMessage(
    submission.userId,
    `u274c *Transaction Rejected*\n\nYour transaction submission has been rejected.\n\nSubmission ID: \`${submissionId}\`\nTransaction ID: \`${submission.transactionId}\`\n\nReason: ${reason}`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Handle pay_now cancel callback
 */
export async function handlePayNowCancelCallback(query: TelegramBot.CallbackQuery): Promise<void> {
  if (!query.message) return;
  
  const chatId = query.message.chat.id;
  
  await bot.answerCallbackQuery(query.id);
  await bot.deleteMessage(chatId, query.message.message_id);
  
  // Return to main menu
  await bot.sendMessage(
    chatId,
    'u25c0ufe0f Returned to main menu. Need something else? Use /help to see available commands.',
    { parse_mode: 'Markdown' }
  );
}

/**
 * Notify all admins of a new transaction submission
 */
async function notifyAdminsOfNewSubmission(submission: TransactionSubmission): Promise<void> {
  // Get admin IDs from environment variable
  const adminIds = process.env.ADMIN_IDS?.split(',').map(id => Number(id.trim())) || [];
  
  if (adminIds.length === 0) {
    console.warn('No admin IDs configured, cannot notify about new submissions');
    return;
  }
  
  const message = [
    'ud83dudcb3 *New Transaction Submission*\n',
    `*Submission ID:* \`${submission.id}\``,
    `*Transaction ID:* \`${submission.transactionId}\``,
    `*User ID:* \`${submission.userId}\``,
    `*Date:* ${new Date(submission.timestamp).toLocaleString()}\n`,
    `To approve: /approve ${submission.id}`,
    `To reject: /reject ${submission.id} [reason]`
  ].join('\n');
  
  // Send notification to each admin
  for (const adminId of adminIds) {
    try {
      await bot.sendMessage(adminId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error(`Failed to notify admin ${adminId}:`, error);
    }
  }
}
