import TelegramBot from 'node-telegram-bot-api';
import { bot } from './bot';
import { isAdmin } from './utils';

// Interface for storing error reports
export interface ErrorReport {
  id: string;
  timestamp: number;
  command: string;
  chatId: number;
  error: string;
  stack?: string;
  metadata?: Record<string, any>;
}

// In-memory storage for recent errors (for simplicity)
// In a production environment, this would be stored in Redis or another persistent store
const errorReports: ErrorReport[] = [];
const MAX_ERROR_REPORTS = 100;

/**
 * Add a new error report to the store
 */
export function addErrorReport(report: ErrorReport): void {
  errorReports.unshift(report); // Add to beginning
  
  // Keep only the most recent errors
  if (errorReports.length > MAX_ERROR_REPORTS) {
    errorReports.length = MAX_ERROR_REPORTS;
  }
  
  // Log the error to console
  console.error(`[ERROR] ${report.id} - ${report.command} - ${report.error}`);
  if (report.stack) {
    console.error(report.stack);
  }
}

/**
 * Get recent error reports
 */
export function getErrorReports(limit: number = 10): ErrorReport[] {
  return errorReports.slice(0, limit);
}

/**
 * Clear all error reports
 */
export function clearErrorReports(): void {
  errorReports.length = 0;
}

/**
 * Create error handler for command functions
 * This wraps command handler functions with error handling logic
 */
export function withErrorBoundary<T extends any[]>(
  commandName: string,
  handler: (...args: T) => Promise<void>
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await handler(...args);
    } catch (error) {
      // Get the chat ID from the first argument if it's a Message object
      let chatId: number | undefined;
      let metadata: Record<string, any> = {};
      
      if (args[0] && typeof args[0] === 'object') {
        if ('chat' in args[0] && args[0].chat && 'id' in args[0].chat) {
          chatId = (args[0] as TelegramBot.Message).chat.id;
        } else if ('message' in args[0] && args[0].message && 'chat' in args[0].message) {
          chatId = (args[0] as TelegramBot.CallbackQuery).message!.chat.id;
        }

        // Add user info to metadata if available
        if ('from' in args[0] && args[0].from) {
          metadata.user = {
            id: args[0].from.id,
            username: args[0].from.username,
            firstName: args[0].from.first_name,
            lastName: args[0].from.last_name
          };
        }
      }

      // Generate a unique error ID
      const errorId = `ERR-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
      
      // Create the error report
      const report: ErrorReport = {
        id: errorId,
        timestamp: Date.now(),
        command: commandName,
        chatId: chatId || 0,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        metadata
      };
      
      // Add the report to our store
      addErrorReport(report);
      
      // Send an error message to the user if we have their chatId
      if (chatId) {
        try {
          await bot.sendMessage(
            chatId,
            `Sorry, an error occurred while processing your request. Error reference: ${errorId}`
          );
        } catch (sendError) {
          console.error('Failed to send error message to user:', sendError);
        }
      }
      
      // Notify admins about critical errors if needed
      if (process.env.ERROR_NOTIFICATION_ENABLED === 'true' && process.env.ADMIN_IDS) {
        const adminIds = process.env.ADMIN_IDS.split(',').map(id => Number(id.trim()));
        
        for (const adminId of adminIds) {
          try {
            const errorMessage = `🚨 *Error Report*\n\nID: \`${errorId}\`\nCommand: \`${commandName}\`\nUser: ${chatId || 'Unknown'}\nTime: ${new Date().toISOString()}\n\nError: \`${report.error}\``;
            await bot.sendMessage(adminId, errorMessage, { parse_mode: 'Markdown' });
          } catch (notifyError) {
            console.error(`Failed to notify admin ${adminId}:`, notifyError);
          }
        }
      }
    }
  };
}

/**
 * Handle the /errors command to view recent error reports
 */
export async function handleErrorsCommand(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  
  // Only admins can view errors
  if (!isAdmin(chatId)) {
    await bot.sendMessage(chatId, 'This command is only available to administrators.');
    return;
  }
  
  // Check if a limit was specified
  const text = msg.text || '';
  const match = text.match(/\/errors\s+(\d+)/);
  const limit = match ? parseInt(match[1]) : 10;
  
  const reports = getErrorReports(limit);
  
  if (reports.length === 0) {
    await bot.sendMessage(chatId, 'No error reports found.');
    return;
  }
  
  let message = `📊 *Recent Error Reports (${reports.length})*\n\n`;
  
  reports.forEach((report, index) => {
    const date = new Date(report.timestamp).toLocaleString();
    message += `${index + 1}. ID: \`${report.id}\`\n`;
    message += `   Command: \`${report.command}\`\n`;
    message += `   User: ${report.chatId}\n`;
    message += `   Time: ${date}\n`;
    message += `   Error: \`${report.error}\`\n\n`;
  });
  
  message += 'To clear all errors, use: /clear_errors';
  
  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

/**
 * Handle the /clear_errors command to clear error reports
 */
export async function handleClearErrorsCommand(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  
  // Only admins can clear errors
  if (!isAdmin(chatId)) {
    await bot.sendMessage(chatId, 'This command is only available to administrators.');
    return;
  }
  
  clearErrorReports();
  await bot.sendMessage(chatId, 'All error reports have been cleared.');
} 