import TelegramBot from 'node-telegram-bot-api';
import { bot } from './bot';
import { isAdmin } from './utils';

/**
 * Custom error class for bot-specific errors
 */
export class BotError extends Error {
  public readonly chatId?: number;
  public readonly command?: string;
  public readonly severity: 'low' | 'medium' | 'high';

  constructor(message: string, options?: {
    chatId?: number;
    command?: string;
    severity?: 'low' | 'medium' | 'high';
  }) {
    super(message);
    this.name = 'BotError';
    this.chatId = options?.chatId;
    this.command = options?.command;
    this.severity = options?.severity || 'medium';
  }
}

/**
 * Handles errors that occur during bot operation
 */
export class ErrorHandler {
  private static readonly DEBUG = process.env.DEBUG_MODE === 'true';
  private static readonly adminIds = process.env.ADMIN_IDS?.split(',').map(id => Number(id.trim())) || [];

  /**
   * Handle an error, notify user and admins as appropriate
   */
  public static async handleError(error: Error | BotError, msg?: TelegramBot.Message): Promise<void> {
    const chatId = (error as BotError).chatId || msg?.chat.id;
    const command = (error as BotError).command || msg?.text;
    const severity = (error as BotError).severity || 'medium';
    
    // Log the error
    console.error(`[ERROR] ${severity.toUpperCase()}: ${error.message}`, {
      chatId,
      command,
      stack: error.stack
    });
    
    // Notify the user if we have their chat ID
    if (chatId) {
      try {
        let errorMessage: string;
        
        if (severity === 'low') {
          errorMessage = '⚠️ Something went wrong with your request. Please try again later.';
        } else if (severity === 'medium') {
          errorMessage = '❌ We encountered an error processing your request. Our team has been notified.';
        } else {
          errorMessage = '🚨 A critical error occurred. Our team has been notified and is working on a fix.';
        }
        
        await bot.sendMessage(chatId, errorMessage);
      } catch (notificationError) {
        console.error('Failed to notify user about error:', notificationError);
      }
    }
    
    // Notify admins for medium and high severity errors
    if (severity !== 'low') {
      await this.notifyAdmins(error, chatId, command, severity);
    }
  }
  
  /**
   * Notify all admins about an error
   */
  private static async notifyAdmins(
    error: Error,
    chatId?: number,
    command?: string,
    severity: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<void> {
    // Format the error details
    let message = `🔴 *Bot Error Notification*\n\n`;
    message += `Severity: ${this.getSeverityEmoji(severity)} ${severity.toUpperCase()}\n`;
    message += `Error: ${error.message}\n`;
    
    if (chatId) {
      message += `User: ${chatId}\n`;
    }
    
    if (command) {
      message += `Command: ${command}\n`;
    }
    
    if (this.DEBUG) {
      // Include stack trace in debug mode
      message += `\n*Stack Trace:*\n\`\`\`\n${error.stack || 'No stack trace'}\n\`\`\``;
    }
    
    // Send to all admins
    for (const adminId of this.adminIds) {
      try {
        await bot.sendMessage(adminId, message, { parse_mode: 'Markdown' });
      } catch (notifyError) {
        console.error(`Failed to notify admin ${adminId}:`, notifyError);
      }
    }
  }
  
  /**
   * Get emoji for error severity
   */
  private static getSeverityEmoji(severity: 'low' | 'medium' | 'high'): string {
    switch (severity) {
      case 'low':
        return '⚠️';
      case 'medium':
        return '❌';
      case 'high':
        return '🚨';
    }
  }
  
  /**
   * Create a global error handler for the bot
   */
  public static setupGlobalErrorHandler(): void {
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.notifyAdmins(error, undefined, undefined, 'high')
        .catch(notifyError => console.error('Error notifying admins:', notifyError));
    });
    
    process.on('unhandledRejection', (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      console.error('Unhandled Rejection:', error);
      this.notifyAdmins(error, undefined, undefined, 'high')
        .catch(notifyError => console.error('Error notifying admins:', notifyError));
    });
  }
}

/**
 * Global wrapper to safely execute command handlers with error handling
 */
export async function safeExecute(
  callback: () => Promise<void>,
  msg: TelegramBot.Message,
  commandName?: string
): Promise<void> {
  try {
    await callback();
  } catch (error) {
    // Handle the error using our error handler
    const botError = error instanceof BotError ? error : new BotError(
      error instanceof Error ? error.message : String(error),
      {
        chatId: msg.chat.id,
        command: commandName || msg.text,
        severity: 'medium'
      }
    );
    
    await ErrorHandler.handleError(botError, msg);
  }
}
