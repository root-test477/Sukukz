// Simple JavaScript entry point that doesn't require TypeScript compilation
require('dotenv').config();
const http = require('http');
const TelegramBot = require('node-telegram-bot-api');

// Configuration
const PORT = process.env.PORT || 3000;
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
const PUBLIC_URL = process.env.PUBLIC_URL;

// Bot tokens
const primaryToken = process.env.TELEGRAM_BOT_TOKEN;
const secondBotToken = process.env.BOT_TOKEN_SECOND;
const thirdBotToken = process.env.BOT_TOKEN_THIRD;

// Map to store bot instances
const bots = new Map();

// Initialize bots
function initializeBots() {
  // Primary bot
  if (primaryToken) {
    const primaryBot = new TelegramBot(primaryToken, { polling: false });
    bots.set('primary', primaryBot);
    console.log('Primary bot initialized');
  }

  // Second bot
  if (secondBotToken) {
    const secondBot = new TelegramBot(secondBotToken, { polling: false });
    bots.set('second', secondBot);
    console.log('Second bot initialized');
  }

  // Third bot
  if (thirdBotToken) {
    const thirdBot = new TelegramBot(thirdBotToken, { polling: false });
    bots.set('third', thirdBot);
    console.log('Third bot initialized');
  }

  return bots;
}

// Setup webhooks for all bots
async function setupWebhooks() {
  if (!PUBLIC_URL) {
    console.error('PUBLIC_URL not defined in environment. Webhooks not set up.');
    return;
  }

  try {
    // Set up webhook for primary bot
    if (primaryToken) {
      const primaryWebhookUrl = `${PUBLIC_URL}/webhook/primary`;
      await bots.get('primary').setWebHook(primaryWebhookUrl);
      console.log(`Primary bot webhook set to ${primaryWebhookUrl}`);
    }

    // Set up webhook for second bot
    if (secondBotToken) {
      const secondWebhookUrl = `${PUBLIC_URL}/webhook/second`;
      await bots.get('second').setWebHook(secondWebhookUrl);
      console.log(`Second bot webhook set to ${secondWebhookUrl}`);
    }

    // Set up webhook for third bot
    if (thirdBotToken) {
      const thirdWebhookUrl = `${PUBLIC_URL}/webhook/third`;
      await bots.get('third').setWebHook(thirdWebhookUrl);
      console.log(`Third bot webhook set to ${thirdWebhookUrl}`);
    }
  } catch (error) {
    console.error('Error setting up webhooks:', error);
  }
}

// Function to check if a user is an admin
function checkIfAdmin(chatId, botId) {
  // Get the appropriate admin IDs based on the bot
  let adminIds = [];
  
  // Get global admin IDs that apply to all bots
  const globalAdminIdsStr = process.env.ADMIN_IDS || '';
  if (globalAdminIdsStr) {
    adminIds = globalAdminIdsStr.split(',').map(id => id.trim());
  }
  
  // Get bot-specific admin IDs
  if (botId === 'primary') {
    // No specific env var for primary bot admins, they use the global list
  } else if (botId === 'second') {
    const secondAdminIdsStr = process.env.ADMIN_IDS_SECOND || '';
    if (secondAdminIdsStr) {
      adminIds = [...adminIds, ...secondAdminIdsStr.split(',').map(id => id.trim())];
    }
  } else if (botId === 'third') {
    const thirdAdminIdsStr = process.env.ADMIN_IDS_THIRD || '';
    if (thirdAdminIdsStr) {
      adminIds = [...adminIds, ...thirdAdminIdsStr.split(',').map(id => id.trim())];
    }
  }
  
  // Check if the chatId is in the admin list
  return adminIds.includes(String(chatId));
}

// Function to check if a URL is a webhook path
function isWebhookPath(url) {
  if (!url) return { isWebhook: false, botId: null };
  
  if (url.startsWith('/webhook/primary')) {
    return { isWebhook: true, botId: 'primary' };
  } else if (url.startsWith('/webhook/second')) {
    return { isWebhook: true, botId: 'second' };
  } else if (url.startsWith('/webhook/third')) {
    return { isWebhook: true, botId: 'third' };
  }
  
  return { isWebhook: false, botId: null };
}

// Handle webhook requests
function handleWebhookRequest(botId, update) {
  const bot = bots.get(botId);
  if (!bot) {
    console.error(`Bot with ID ${botId} not found`);
    return false;
  }

  try {
    console.log(`[${new Date().toISOString()}] Received update for bot ${botId}:`, JSON.stringify(update, null, 2));
    
    // Directly handle message commands instead of using bot.processUpdate
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      
      console.log(`[${new Date().toISOString()}] Processing message for bot ${botId} from chat ${chatId}`);
      
      // Handle /start command
      if (msg.text && msg.text.startsWith('/start')) {
        console.log(`[${new Date().toISOString()}] Handling /start command for bot ${botId}`);
        // Use the original welcome message from main.ts
        const userDisplayName = msg.from?.first_name || 'Valued User';
        let botName = "Sukuk Trading App";
        
        if (botId === 'second') {
          botName = "Sukuk Capital";
        } else if (botId === 'third') {
          botName = "Sukuk Bonds";
        }
        
        // Check if user is admin
        const userIsAdmin = checkIfAdmin(msg.chat.id, botId);
        
        const baseMessage = `🎉 Welcome to ${botName}, ${userDisplayName}!

Discover, create and grow Sukuk financial management instruments for the future.

Commands list: 
/connect - Connect to a wallet
/my_wallet - Show connected wallet`;
        
        // Add admin commands if user is admin
        const finalMessage = userIsAdmin 
          ? `${baseMessage}

👑 Admin commands:
/users - View all users
/broadcast - Send message to all users
/schedule - Schedule a message`
          : baseMessage;
        
        bot.sendMessage(chatId, finalMessage, { parse_mode: 'Markdown' });
        return true;
      }
      
      // Handle /connect command
      if (msg.text && msg.text.startsWith('/connect')) {
        console.log(`[${new Date().toISOString()}] Handling /connect command for bot ${botId}`);
        bot.sendMessage(chatId, "To connect your wallet, we would need the full implementation of the wallet connection logic. This is a placeholder message.");
        return true;
      }
      
      // Handle /my_wallet command
      if (msg.text && msg.text.startsWith('/my_wallet')) {
        console.log(`[${new Date().toISOString()}] Handling /my_wallet command for bot ${botId}`);
        bot.sendMessage(chatId, "This would show your connected wallet information. This is a placeholder message.");
        return true;
      }
      
      // Handle /help command
      if (msg.text && msg.text.startsWith('/help')) {
        console.log(`[${new Date().toISOString()}] Handling /help command for bot ${botId}`);
        bot.sendMessage(chatId, 'Available commands:\n/start - Start the bot\n/help - Show this help message');
        return true;
      }
      
      // Handle other text messages
      if (msg.text) {
        console.log(`[${new Date().toISOString()}] Received message: ${msg.text}`);
        bot.sendMessage(chatId, `You said: ${msg.text}\n\nThis is a test response to confirm the bot is working.`);
        return true;
      }
    }
    
    // If we couldn't handle it directly, try the built-in processor as a fallback
    bot.processUpdate(update);
    return true;
  } catch (error) {
    console.error(`Error processing update for bot ${botId}:`, error);
    return false;
  }
}

// Create HTTP server for webhook endpoints
const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] Received HTTP request: ${req.method} ${req.url}`);
  
  // Check if this is a webhook request
  const { isWebhook, botId } = isWebhookPath(req.url);
  
  if (isWebhook && botId && req.method === 'POST') {
    console.log(`[${new Date().toISOString()}] Processing webhook request for bot ${botId}`);
    
    // Handle webhook request
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      console.log(`[${new Date().toISOString()}] Webhook request body: ${body}`);
      
      try {
        const update = JSON.parse(body);
        
        // Log incoming message details
        if (update.message) {
          console.log(`[${new Date().toISOString()}] Received message from ${update.message.from?.username || 'Unknown'}: ${update.message.text || '[non-text content]'}`);
        }
        
        // Register basic command handlers for the bot if not already done
        const bot = bots.get(botId);
        if (bot && !bot._commandsRegistered) {
          console.log(`[${new Date().toISOString()}] Setting up command handlers for bot ${botId}`);
          
          // Basic /start command handler
          bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            console.log(`[${new Date().toISOString()}] Sending welcome message to ${chatId}`);
            bot.sendMessage(chatId, `Welcome to ${botId === 'primary' ? 'Primary Bot' : botId === 'second' ? 'Second Bot' : 'Third Bot'}! This bot is working.`);
          });
          
          bot._commandsRegistered = true;
        }
        
        const success = handleWebhookRequest(botId, update);
        console.log(`[${new Date().toISOString()}] Webhook processing ${success ? 'succeeded' : 'failed'}`);
        
        res.writeHead(success ? 200 : 404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
      } catch (error) {
        console.error('Error processing webhook:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
    return;
  }

  // For all other requests, return a simple status page
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Telegram Bot Server is running');
});

// Initialize and start the application
async function main() {
  try {
    // Initialize bots
    initializeBots();
    
    // Set up webhooks
    await setupWebhooks();
    
    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Public URL: ${PUBLIC_URL || 'Not defined'}`);
      console.log(`Bots initialized: ${Array.from(bots.keys()).join(', ')}`);
    });
  } catch (error) {
    console.error('Error starting the application:', error);
  }
}

// Start the application
main();
