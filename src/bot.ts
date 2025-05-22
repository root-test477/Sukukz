import TelegramBot from 'node-telegram-bot-api';
import * as process from 'process';

// Support for multiple bot tokens
interface BotInstance {
  bot: TelegramBot;
  id: string;
  name: string;
}

// Get primary bot token (backwards compatibility)
const primaryToken = process.env.TELEGRAM_BOT_TOKEN!;

// Create the primary bot instance
export const bot = new TelegramBot(primaryToken, { polling: true });

// Map to store all bot instances
export const bots = new Map<string, BotInstance>();

// Add the primary bot to the map
bots.set('primary', {
  bot,
  id: 'primary',
  name: 'Primary Bot'
});

// Parse additional bot tokens from environment variables
function initAdditionalBots() {
  // Look for variables like BOT_TOKEN_1, BOT_TOKEN_2, etc.
  const botTokenPattern = /^BOT_TOKEN_(\w+)$/;
  const botNamePattern = /^BOT_NAME_(\w+)$/;
  
  // Get all environment variables
  const envVars = process.env;
  
  // Find all additional bot tokens
  for (const key in envVars) {
    const tokenMatch = key.match(botTokenPattern);
    if (tokenMatch && tokenMatch[1]) {
      const botId = tokenMatch[1];
      const token = envVars[key];
      
      if (token) {
        // Look for a corresponding name
        const nameKey = `BOT_NAME_${botId}`;
        const botName = envVars[nameKey] || `Bot ${botId}`;
        
        // Create new bot instance
        const newBot = new TelegramBot(token, { polling: true });
        
        // Store in the map
        bots.set(botId, {
          bot: newBot,
          id: botId,
          name: botName
        });
        
        console.log(`Initialized additional bot: ${botName} (${botId})`);
      }
    }
  }
}

// Initialize additional bots from environment variables
initAdditionalBots();

// Helper function to get a bot instance by ID
export function getBotById(botId: string): TelegramBot | undefined {
  return bots.get(botId)?.bot || (botId === 'primary' ? bot : undefined);
}

// Function to get all bot instances
export function getAllBots(): BotInstance[] {
  return Array.from(bots.values());
}
