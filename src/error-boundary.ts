import TelegramBot from 'node-telegram-bot-api';
import { botManager } from './bot-manager';
import { isAdmin } from './utils';

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
          // Try to extract botId from the arguments
          let botId: string = 'main'; // Default to 'main' instead of 'default'
          if (args.length > 1 && typeof args[1] === 'string') {
            botId = args[1];
          }
          
          // Make sure botId is a valid string
          const safeBotId = typeof botId === 'string' ? botId : 'main';
          // Get the bot instance - try the specified botId first, then fall back to the first available bot
          let botInstance: TelegramBot | undefined = botManager.getBot(safeBotId);
          if (!botInstance) {
            // If no bot found with the specified ID, get the first available bot
            const allBots = botManager.getAllBots();
            if (allBots.size > 0) {
              const firstBotId = Array.from(allBots.keys())[0] as string;
              botInstance = allBots.get(firstBotId);
              // Type assertion to handle potential undefined values
              const logBotId = botId || 'unknown';
              console.log(`Bot ID ${logBotId} not found, falling back to ${firstBotId} for message sending`);
            }
          }
          
          if (botInstance) {
            // Send a user-friendly error message
            if (botInstance.sendMessage) {
              await botInstance.sendMessage(
                chatId,
                "⚠️ There was a problem processing your request. Please try again later."
              );
            } else {
              console.error('Bot instance does not have sendMessage method');
            }
          } else {
            console.error('No available bot instances to send error message');
          }
          
          // Notify admin(s) about the error
          const adminIdsStr = process.env.ADMIN_IDS || '';
          const adminIds = adminIdsStr.split(',').filter(id => id.trim()).map(id => Number(id.trim()));
          if (adminIds.length > 0) {
            const commandText = typeof args[0] === 'object' && args[0] && 'text' in args[0] ? String(args[0].text) : 'Unknown';
            const errorDetails = `
🔴 *Bot Error Report*

*Error Type*: ${error instanceof Error ? error.name : 'Unknown'}
*Message*: ${error instanceof Error ? error.message : String(error)}
*User ID*: ${chatId}
*Command*: ${commandText}
*Time*: ${new Date().toISOString()}`;

            for (const adminId of adminIds) {
              try {
                // Try to extract botId from the arguments
                let botId: string = 'main'; // Default to 'main' instead of 'default'
                if (args.length > 1 && typeof args[1] === 'string') {
                  botId = args[1];
                }
                
                // Make sure botId is a string before passing to isAdmin
                const validBotId = typeof botId === 'string' ? botId : 'main';
                if (adminId !== chatId || isAdmin(chatId, validBotId)) {
                  // Get the bot instance - try the specified botId first, then fall back to the first available bot
                  let botInstance = botManager.getBot(validBotId);
                  if (!botInstance) {
                    // If no bot found with the specified ID, get the first available bot
                    const allBots = botManager.getAllBots();
                    if (allBots.size > 0) {
                      const firstBotId = Array.from(allBots.keys())[0] as string;
                      botInstance = allBots.get(firstBotId);
                      // Type assertion to handle potential undefined values
                      const logBotId = validBotId || 'unknown';
                      console.log(`Bot ID ${logBotId} not found for admin notification, falling back to ${firstBotId}`);
                    }
                  }
                  
                  if (botInstance) {
                    // Escape any Markdown that might cause formatting issues
                    const safeErrorDetails = errorDetails
                      .replace(/\*/g, '\\*')
                      .replace(/_/g, '\\_')
                      .replace(/\[/g, '\\[')
                      .replace(/\]/g, '\\]')
                      .replace(/\(/g, '\\(')
                      .replace(/\)/g, '\\)')
                      .replace(/~/g, '\\~')
                      .replace(/`/g, '\\`')
                      .replace(/>/g, '\\>');
                    
                    await botInstance.sendMessage(adminId, safeErrorDetails, { parse_mode: 'Markdown' });
                  }
                }
              } catch (notifyError) {
                console.error(`Failed to notify admin ${adminId} about error:`, notifyError);
              }
            }
          }
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
export async function safeSendMessage(
  chatId: number, 
  text: string, 
  options?: TelegramBot.SendMessageOptions,
  botId: string = ''
): Promise<TelegramBot.Message> {
  try {
    // Try to get the bot instance using the provided ID
    // Make sure we have a valid string for botId
    const validBotId = typeof botId === 'string' && botId.length > 0 ? botId : 'main';
    let botInstance = botManager.getBot(validBotId);
    
    // If no bot found with the specified ID, fallback to the first available bot
    if (!botInstance) {
      const allBots = botManager.getAllBots();
      if (allBots.size > 0) {
        // Get the first bot ID and ensure it's a valid string
        const botKeys = Array.from(allBots.keys());
        if (botKeys.length > 0) {
          const firstBotId = botKeys[0] as string;
          // Verify the key is a non-empty string before using it
          if (typeof firstBotId === 'string' && firstBotId.length > 0) {
            botInstance = allBots.get(firstBotId);
            console.log(`Bot ID not found, falling back to ${firstBotId} for message sending`);
          }
        }
      }
    }
    
    // If still no bot instance found, throw an error
    if (!botInstance) {
      throw new Error(`No bot instances available for sending messages`);
    }
    
    return await botInstance.sendMessage(chatId, text, options);
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
      
      // Try to get the bot instance again
      // Make sure we have a valid string for botId
      const validRetryBotId = typeof botId === 'string' && botId.length > 0 ? botId : 'main';
      let botInstance = botManager.getBot(validRetryBotId);
      
      // If no bot found with the specified ID, fallback to the first available bot
      if (!botInstance) {
        const allBots = botManager.getAllBots();
        if (allBots.size > 0) {
          const botKeys = Array.from(allBots.keys());
          if (botKeys.length > 0) {
            // Use type assertion to ensure TypeScript knows this is a string
            const firstBotId = botKeys[0] as string;
            // Verify the key is a non-empty string before using it
            if (typeof firstBotId === 'string' && firstBotId.length > 0) {
              botInstance = allBots.get(firstBotId);
            }
          }
        }
      }
      
      // If still no bot instance found, throw an error
      if (!botInstance) {
        throw new Error(`No bot instances available for sending messages`);
      }
      
      // Add a note about formatting
      return await botInstance.sendMessage(
        chatId, 
        text + "\n\n(Note: Some formatting was removed due to technical issues)", 
        safeOptions
      );
    }
    
    // If it's another kind of error, rethrow it
    throw error;
  }
}
