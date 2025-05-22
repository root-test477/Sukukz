import TelegramBot from 'node-telegram-bot-api';
import * as process from 'process';

// Support for multiple bot tokens
interface BotInstance {
  bot: TelegramBot;
  id: string;
  name: string;
}

// Global configuration
const DEBUG = process.env.DEBUG_MODE === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Get the port from environment variable or use 10000 as default
const PORT = process.env.PORT || 10000;

// Build the webhook URL based on the environment
// In production, we'll use the render.com URL
// In development, we can use ngrok or a similar tool
const BASE_URL = process.env.PUBLIC_URL || `https://telegram-bot-demo.onrender.com`;

// IMPORTANT: Using a single shared webhook endpoint for all bots
const WEBHOOK_PATH = '/webhook';

// Get primary bot token (backwards compatibility)
const primaryToken = process.env.TELEGRAM_BOT_TOKEN!;

// Create the primary bot instance - NO POLLING IN PRODUCTION
const botOptions = IS_PRODUCTION
  ? { polling: false } // No polling in production, we'll use webhooks
  : { polling: true };  // Use polling in development for easier testing

export const bot = new TelegramBot(primaryToken, botOptions);

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
          // Always create bot instances without polling
          // We'll either use webhooks in production or enable polling manually in development
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

// Set up webhooks or polling for all bots based on environment
export function setupBotCommunication() {
  if (IS_PRODUCTION) {
    // In production, set up webhooks for all bots
    setupWebhooks();
  } else {
    // In development, use polling for the main bot only
    // (We already set this up when creating the bot instance)
    console.log('Development mode: Using polling for primary bot only');
  }
}

// Set up webhooks for all bots
function setupWebhooks() {
  // Set the webhook for each bot
  for (const [botId, botInstance] of bots.entries()) {
    const webhookUrl = `${BASE_URL}${WEBHOOK_PATH}/${botId}`;
    
    botInstance.bot.setWebHook(webhookUrl)
      .then(() => {
        console.log(`Webhook set for bot ${botInstance.name} (${botId}): ${webhookUrl}`);
      })
      .catch(error => {
        console.error(`Failed to set webhook for bot ${botInstance.name} (${botId}):`, error);
      });
  }
}

// Function to handle incoming webhook requests
export function handleWebhookRequest(botId: string, update: any) {
  const botInstance = bots.get(botId);
  if (botInstance) {
    botInstance.bot.processUpdate(update);
    return true;
  }
  return false;
}

// Helper function to get a bot instance by ID
export function getBotById(botId: string): TelegramBot | undefined {
  return bots.get(botId)?.bot || (botId === 'primary' ? bot : undefined);
}

// Function to get all bot instances
export function getAllBots(): BotInstance[] {
  return Array.from(bots.values());
}

// Get the webhook path for a bot
export function getWebhookPath(botId: string): string {
  return `${WEBHOOK_PATH}/${botId}`;
}

// Determine if a path is a webhook path
export function isWebhookPath(path: string): { isWebhook: boolean, botId: string | null } {
  const match = path.match(new RegExp(`^${WEBHOOK_PATH}/([\w-]+)$`));
  if (match && match[1]) {
    return { isWebhook: true, botId: match[1] };
  }
  return { isWebhook: false, botId: null };
}
