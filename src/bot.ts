import TelegramBot from 'node-telegram-bot-api';
import * as process from 'process';

// Support for multiple bot tokens
interface BotInstance {
  bot: TelegramBot;
  id: string;
  name: string;
}

// Global polling configuration
const DEBUG = process.env.DEBUG_MODE === 'true';

// Get primary bot token (backwards compatibility)
const primaryToken = process.env.TELEGRAM_BOT_TOKEN!;

// Create the primary bot instance with polling mode
export const bot = new TelegramBot(primaryToken, { polling: true });

// Map to store all bot instances
export const bots = new Map<string, BotInstance>();

// Add the primary bot to the map
bots.set('primary', {
  bot,
  id: 'primary',
  name: process.env.BOT_NAME_PRIMARY || 'Primary Bot'
});

// Parse additional bot tokens from environment variables
function initAdditionalBots() {
  // Look for variables like BOT_TOKEN_1, BOT_TOKEN_2, etc.
  const botTokenPattern = /^BOT_TOKEN_(\w+)$/;
  
  // Get all environment variables
  const envVars = process.env;
  
  // Find all additional bot tokens
  for (const key in envVars) {
    const tokenMatch = key.match(botTokenPattern);
    if (tokenMatch && tokenMatch[1]) {
      const botId = tokenMatch[1];
      // Skip 'PRIMARY' since it's already handled
      if (botId.toUpperCase() === 'PRIMARY') continue;
      
      const token = envVars[key];
      
      if (token) {
        // Look for a corresponding name
        const nameKey = `BOT_NAME_${botId}`;
        const botName = envVars[nameKey] || `Bot ${botId}`;
        
        try {
          // Create new bot instance WITHOUT polling (we'll use the API instead)
          const newBot = new TelegramBot(token, { polling: false });
          
          // Store in the map
          bots.set(botId.toLowerCase(), {
            bot: newBot,
            id: botId.toLowerCase(),
            name: botName
          });
          
          console.log(`Initialized additional bot: ${botName} (${botId})`);
        } catch (error) {
          console.error(`Error initializing bot ${botId}:`, error);
        }
      }
    }
  }
}

// Initialize additional bots from environment variables
initAdditionalBots();

// Set up manual polling for additional bots
function manualPollAdditionalBots() {
  // Skip the primary bot since it's already polling
  const additionalBots = Array.from(bots.entries())
    .filter(([id, _]) => id !== 'primary');

  if (additionalBots.length === 0) return;

  // Process function to handle updates - NOTE: This function is no longer used
  // but kept for reference purposes
  async function processBot(botId: string, botInstance: BotInstance) {
    try {
      const updates = await botInstance.bot.getUpdates();
      
      if (updates && updates.length > 0) {
        // Process each update
        for (const update of updates) {
          // Manually emit events based on update type
          if (update.message) {
            botInstance.bot.processUpdate(update);
          } else if (update.callback_query) {
            botInstance.bot.processUpdate(update);
          } else if (update.inline_query) {
            botInstance.bot.processUpdate(update);
          }
        }
        
        // Acknowledge updates by getting updates with higher offset
        if (updates.length > 0) {
          const lastUpdate = updates[updates.length - 1];
          if (lastUpdate && lastUpdate.update_id) {
            await botInstance.bot.getUpdates({ offset: lastUpdate.update_id + 1 });
          }
        }
      }
    } catch (error) {
      console.error(`Error polling updates for bot ${botId}:`, error);
    }
  }

  // Enable manual polling for additional bots
  // Each bot polls independently to avoid conflicts
  // The offset parameter ensures we don't process the same updates multiple times
  
  // Initialize offset tracking for each bot
  const offsetMap = new Map<string, number>();
  
  // Poll each bot every few seconds
  for (const [botId, botInstance] of additionalBots) {
    // Start with offset 0 for each bot
    offsetMap.set(botId, 0);
    
    // Set up polling interval
    setInterval(async () => {
      try {
        // Get current offset for this bot
        const currentOffset = offsetMap.get(botId) || 0;
        
        // Get updates with the current offset
        const updates = await botInstance.bot.getUpdates({ 
          offset: currentOffset,
          timeout: 1 // Short timeout to avoid blocking
        });
        
        if (updates && updates.length > 0) {
          // Process each update
          for (const update of updates) {
            botInstance.bot.processUpdate(update);
          }
          
          // Update offset to highest update_id + 1
          const lastUpdate = updates[updates.length - 1];
          if (lastUpdate && lastUpdate.update_id) {
            const newOffset = lastUpdate.update_id + 1;
            offsetMap.set(botId, newOffset);
            
            if (DEBUG) {
              console.log(`Bot ${botId} processed ${updates.length} updates, new offset: ${newOffset}`);
            }
          }
        }
      } catch (error) {
        console.error(`Error in manual polling for bot ${botId}:`, error);
      }
    }, 3000); // Poll every 3 seconds
    
    console.log(`Started manual polling for bot: ${botInstance.name} (${botId})`);
  }
}

// Start manual polling if needed
manualPollAdditionalBots();

// Helper function to get a bot instance by ID
export function getBotById(botId: string): TelegramBot | undefined {
  return bots.get(botId)?.bot || (botId === 'primary' ? bot : undefined);
}

// Function to get all bot instances
export function getAllBots(): BotInstance[] {
  return Array.from(bots.values());
}
