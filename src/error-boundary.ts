import TelegramBot from 'node-telegram-bot-api';
import { bot } from './bot';
import { isAdmin } from './utils';
import { saveErrorReport, getRedisClient } from './ton-connect/storage';
import { BotError, ErrorType } from './error-types';

/**
 * Error boundary wrapper for bot command handlers
 * Prevents errors in individual commands from crashing the entire bot
 * 
 * @param handler The original command handler function
 * @returns A wrapped function that catches errors
 */
export function withErrorBoundary<T extends any[]>(
  handler: (...args: T) => Promise<void>
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await handler(...args);
    } catch (error) {
      console.error(`Error in command handler: ${error instanceof Error ? error.message : error}`);
      console.error(error);
      
      // Convert to BotError if it's not already
      const botError = error instanceof BotError 
        ? error 
        : BotError.fromError(
            error instanceof Error ? error : new Error(String(error)),
            ErrorType.COMMAND_ERROR
          );
      
      // Save error report to Redis
      try {
        await saveErrorReport(botError.toObject());
      } catch (saveError) {
        console.error('Failed to save error report:', saveError);
      }

      // Try to extract chatId from the arguments (assuming first arg is Message or CallbackQuery)
      let chatId: number | undefined;
      
      if (args.length > 0) {
        const firstArg = args[0];
        
        if (firstArg && typeof firstArg === 'object') {
          // For normal messages
          if ('chat' in firstArg && firstArg.chat && 'id' in firstArg.chat) {
            chatId = firstArg.chat.id;
          }
          // For callback queries
          else if ('message' in firstArg && 
                   firstArg.message && 
                   'chat' in firstArg.message && 
                   firstArg.message.chat &&
                   'id' in firstArg.message.chat) {
            chatId = firstArg.message.chat.id;
          }
        }
      }

      if (chatId) {
        try {
          // Send a user-friendly error message
          await bot.sendMessage(
            chatId,
            "⚠️ There was a problem processing your request. Please try again later."
          );
          
          // Notify admin(s) about the error
          await sendErrorReport(botError, chatId, args[0]?.text || 'Unknown');
        } catch (sendError) {
          console.error('Error sending error notification:', sendError);
        }
      }
    }
  };
}

/**
 * Safe message sender that handles Markdown parsing errors
 * If sending with Markdown fails, it will retry without Markdown
 */
/**
 * Send error report to administrators
 * @param error The error object
 * @param userId The user ID who triggered the error
 * @param command The command that caused the error
 */
export async function sendErrorReport(error: BotError | Error, userId?: number, command?: string): Promise<void> {
  const adminIds = process.env.ADMIN_IDS?.split(',').map(id => Number(id.trim())) || [];
  if (adminIds.length === 0) return;
  
  const botError = error instanceof BotError 
    ? error 
    : BotError.fromError(error, ErrorType.UNKNOWN_ERROR, userId, command);
  
  // Update user ID and command if provided
  if (userId && !botError.userId) botError.userId = userId;
  if (command && !botError.command) botError.command = command;
  
  const errorDetails = `
🔴 *Bot Error Report*

*Error Type*: ${botError.type || 'Unknown'}
*Message*: ${botError.message}
*User ID*: ${botError.userId || 'Unknown'}
*Command*: ${botError.command || 'Unknown'}
*Time*: ${new Date(botError.timestamp).toISOString()}`;

  for (const adminId of adminIds) {
    try {
      if (adminId !== botError.userId || (botError.userId && isAdmin(botError.userId))) {
        await bot.sendMessage(adminId, errorDetails, { parse_mode: 'Markdown' });
      }
    } catch (notifyError) {
      console.error(`Failed to notify admin ${adminId} about error:`, notifyError);
    }
  }
}

/**
 * Safe message sender that handles Markdown parsing errors
 * If sending with Markdown fails, it will retry without Markdown
 */
export async function safeSendMessage(
  chatId: number, 
  text: string, 
  options?: TelegramBot.SendMessageOptions
): Promise<TelegramBot.Message> {
  try {
    return await bot.sendMessage(chatId, text, options);
  } catch (error) {
    if (
      error && 
      typeof error === 'object' && 
      'message' in error && 
      typeof error.message === 'string' && 
      error.message.includes('parse entities')
    ) {
      console.warn('Markdown parsing error, retrying without markdown formatting');
      
      // Try again without markdown parsing
      const safeOptions = { ...options };
      if (safeOptions.parse_mode) {
        delete safeOptions.parse_mode;
      }
      
      // Add a note about formatting
      return await bot.sendMessage(
        chatId, 
        text + "\n\n(Note: Some formatting was removed due to technical issues)", 
        safeOptions
      );
    }
    
    // If it's another kind of error, rethrow it
    throw error;
  }
}
