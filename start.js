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
    // Process the update
    bot.processUpdate(update);
    return true;
  } catch (error) {
    console.error(`Error processing update for bot ${botId}:`, error);
    return false;
  }
}

// Create HTTP server for webhook endpoints
const server = http.createServer((req, res) => {
  // Check if this is a webhook request
  const { isWebhook, botId } = isWebhookPath(req.url);
  
  if (isWebhook && botId && req.method === 'POST') {
    // Handle webhook request
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const update = JSON.parse(body);
        const success = handleWebhookRequest(botId, update);
        
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
