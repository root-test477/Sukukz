// Enhanced JavaScript implementation with original bot functionality
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

// Initialize bots with proper error handling
function initializeBots() {
  // Error boundary wrapper for command handlers
  const withErrorBoundary = (handler) => {
    return async (msg, match) => {
      try {
        await handler(msg, match);
      } catch (error) {
        console.error(`Error handling command:`, error);
        const chatId = msg.chat.id;
        const botId = getBotIdFromMsg(msg);
        const bot = bots.get(botId || 'primary');
        
        if (bot) {
          bot.sendMessage(
            chatId,
            '⚠️ An error occurred while processing your command. Please try again later.'
          );
        }
      }
    };
  };

  // Determine which bot sent a message
  const getBotIdFromMsg = (msg) => {
    // This is a simplification - in practice, you'd need to track which bot
    // received which message, perhaps through context in the webhook
    if (msg._botId) return msg._botId;
    
    // Default to primary bot if we can't determine
    return 'primary';
  };

  // Primary bot
  if (primaryToken) {
    const primaryBot = new TelegramBot(primaryToken, { polling: false });
    bots.set('primary', primaryBot);
    setupBotHandlers(primaryBot, 'primary');
    console.log('Primary bot initialized');
  }

  // Second bot
  if (secondBotToken) {
    const secondBot = new TelegramBot(secondBotToken, { polling: false });
    bots.set('second', secondBot);
    setupBotHandlers(secondBot, 'second');
    console.log('Second bot initialized');
  }

  // Third bot
  if (thirdBotToken) {
    const thirdBot = new TelegramBot(thirdBotToken, { polling: false });
    bots.set('third', thirdBot);
    setupBotHandlers(thirdBot, 'third');
    console.log('Third bot initialized');
  }

  return bots;
}

// Set up command handlers for a specific bot
function setupBotHandlers(bot, botId) {
  // Mark messages with their bot ID for context
  const originalProcessUpdate = bot.processUpdate.bind(bot);
  bot.processUpdate = function(update) {
    if (update.message) {
      update.message._botId = botId;
    }
    return originalProcessUpdate(update);
  };
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

// Redis client simulation for storage (simplified version of original storage.ts)
const userDataStore = new Map();
const connectorStore = new Map();

function getUserData(chatId, botId) {
  const key = `${chatId}:${botId || 'primary'}`;
  return userDataStore.get(key) || { walletEverConnected: false };
}

function saveUserData(chatId, botId, data) {
  const key = `${chatId}:${botId || 'primary'}`;
  userDataStore.set(key, data);
  console.log(`Saved user data for ${key}:`, data);
  return true;
}

function updateUserData(chatId, botId, updates) {
  const key = `${chatId}:${botId || 'primary'}`;
  const existingData = userDataStore.get(key) || {};
  const updatedData = { ...existingData, ...updates };
  userDataStore.set(key, updatedData);
  console.log(`Updated user data for ${key}:`, updatedData);
  return true;
}

// Simplified wallet connector implementation
class WalletConnector {
  constructor(chatId, botId) {
    this.chatId = chatId;
    this.botId = botId;
    this.connected = false;
    this.wallet = null;
  }
  
  async connect() {
    this.connected = true;
    this.wallet = {
      account: {
        address: '0x123456789abcdef',
        chain: 'TESTNET'
      },
      device: {
        appName: 'Sample Wallet'
      }
    };
    return true;
  }
  
  async disconnect() {
    this.connected = false;
    this.wallet = null;
    return true;
  }
  
  async restoreConnection() {
    // Simulate restoring a previous connection
    return this.connect();
  }
}

function getConnector(chatId, deviceId, botId) {
  const key = `${chatId}:${botId || 'primary'}`;
  if (!connectorStore.has(key)) {
    connectorStore.set(key, new WalletConnector(chatId, botId));
  }
  return connectorStore.get(key);
}

// Handle webhook requests with enhanced functionality
function handleWebhookRequest(botId, update) {
  const bot = bots.get(botId);
  if (!bot) {
    console.error(`Bot with ID ${botId} not found`);
    return false;
  }

  try {
    console.log(`[${new Date().toISOString()}] Received update for bot ${botId}:`, JSON.stringify(update, null, 2));
    
    // Mark the update with the bot ID for context
    if (update.message) {
      update.message._botId = botId;
    } else if (update.callback_query && update.callback_query.message) {
      update.callback_query.message._botId = botId;
    }
    
    // Directly handle message commands instead of using bot.processUpdate
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      
      console.log(`[${new Date().toISOString()}] Processing message for bot ${botId} from chat ${chatId}`);
      
      // Handle /start command
      if (msg.text && msg.text.startsWith('/start')) {
        console.log(`[${new Date().toISOString()}] Handling /start command for bot ${botId}`);
        handleStartCommand(bot, msg, botId);
        return true;
      }
      
      // Handle /connect command
      if (msg.text && msg.text.startsWith('/connect')) {
        console.log(`[${new Date().toISOString()}] Handling /connect command for bot ${botId}`);
        handleConnectCommand(bot, msg, botId);
        return true;
      }
      
      // Handle /my_wallet command
      if (msg.text && msg.text.startsWith('/my_wallet')) {
        console.log(`[${new Date().toISOString()}] Handling /my_wallet command for bot ${botId}`);
        handleMyWalletCommand(bot, msg, botId);
        return true;
      }
      
      // Handle /users command (admin only)
      if (msg.text && msg.text.startsWith('/users')) {
        console.log(`[${new Date().toISOString()}] Handling /users command for bot ${botId}`);
        handleUsersCommand(bot, msg, botId);
        return true;
      }
      
      // Handle /help command
      if (msg.text && msg.text.startsWith('/help')) {
        console.log(`[${new Date().toISOString()}] Handling /help command for bot ${botId}`);
        handleHelpCommand(bot, msg, botId);
        return true;
      }
      
      // Handle other text messages
      if (msg.text) {
        console.log(`[${new Date().toISOString()}] Received message: ${msg.text}`);
        bot.sendMessage(chatId, `You said: ${msg.text}\n\nType /help to see available commands.`);
        return true;
      }
    }
    
    // Handle callback queries (button clicks)
    if (update.callback_query) {
      console.log(`[${new Date().toISOString()}] Handling callback query for bot ${botId}`);
      handleCallbackQuery(bot, update.callback_query, botId);
      return true;
    }
    
    // If we couldn't handle it directly, try the built-in processor as a fallback
    bot.processUpdate(update);
    return true;
  } catch (error) {
    console.error(`Error processing update for bot ${botId}:`, error);
    return false;
  }
}

// Command handlers
function handleStartCommand(bot, msg, botId) {
  const chatId = msg.chat.id;
  const userDisplayName = msg.from?.first_name || 'Valued User';
  let botName = "Sukuk Trading App";
  
  if (botId === 'second') {
    botName = "Sukuk Capital";
  } else if (botId === 'third') {
    botName = "Sukuk Bonds";
  }
  
  // Check if user is admin
  const userIsAdmin = checkIfAdmin(chatId, botId);
  
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
  
  // Track user interaction
  updateUserData(chatId, botId, { 
    chatId, 
    username: msg.from?.username,
    first_name: msg.from?.first_name,
    last_name: msg.from?.last_name,
    last_interaction: new Date().toISOString(),
  });
  
  bot.sendMessage(chatId, finalMessage, { parse_mode: 'Markdown' });
}

function handleConnectCommand(bot, msg, botId) {
  const chatId = msg.chat.id;
  
  // Create inline keyboard for wallet connection
  const keyboard = {
    inline_keyboard: [
      [{ text: '💳 Connect Wallet', callback_data: 'connect_wallet' }]
    ]
  };
  
  bot.sendMessage(chatId, "Choose an option to connect your wallet:", {
    reply_markup: keyboard
  });
}

function handleMyWalletCommand(bot, msg, botId) {
  const chatId = msg.chat.id;
  const userData = getUserData(chatId, botId);
  
  if (!userData.walletEverConnected) {
    bot.sendMessage(chatId, "You don't have a wallet connected. Use /connect to connect your wallet.");
    return;
  }
  
  // Try to restore wallet connection
  const connector = getConnector(chatId, undefined, botId);
  connector.restoreConnection().then(() => {
    if (connector.connected && connector.wallet) {
      const walletAddress = connector.wallet.account.address;
      const walletName = connector.wallet.device.appName;
      
      bot.sendMessage(chatId, `🔗 Connected wallet: ${walletName}\n📝 Address: ${walletAddress}`);
    } else {
      bot.sendMessage(chatId, "Unable to restore your wallet connection. Please reconnect using /connect.");
    }
  }).catch(error => {
    console.error('Error restoring wallet connection:', error);
    bot.sendMessage(chatId, "An error occurred while trying to restore your wallet connection.");
  });
}

function handleUsersCommand(bot, msg, botId) {
  const chatId = msg.chat.id;
  
  // Check if user is admin
  if (!checkIfAdmin(chatId, botId)) {
    bot.sendMessage(chatId, "⚠️ You don't have permission to use this command.");
    return;
  }
  
  // Get all users for this bot
  const allUsers = [];
  for (const [key, data] of userDataStore.entries()) {
    if (key.endsWith(`:${botId}`)) {
      allUsers.push(data);
    }
  }
  
  if (allUsers.length === 0) {
    bot.sendMessage(chatId, "No users found for this bot.");
    return;
  }
  
  // Generate user report
  let messageText = `📊 *User Report*\n\n`;
  messageText += `Total users: ${allUsers.length}\n`;
  messageText += `-------------------\n`;
  
  allUsers.forEach((user, index) => {
    messageText += `User ${index + 1}:\n`;
    messageText += `- Chat ID: ${user.chatId}\n`;
    messageText += `- Username: ${user.username || 'N/A'}\n`;
    messageText += `- Name: ${user.first_name || ''} ${user.last_name || ''}\n`;
    messageText += `- Last activity: ${user.last_interaction || 'Unknown'}\n`;
    messageText += `- Wallet connected: ${user.walletEverConnected ? 'Yes' : 'No'}\n`;
    messageText += `-------------------\n`;
  });
  
  bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown' });
}

function handleHelpCommand(bot, msg, botId) {
  const chatId = msg.chat.id;
  const userIsAdmin = checkIfAdmin(chatId, botId);
  
  let helpMessage = "*Available commands:*\n\n";
  helpMessage += "/start - Start the bot\n";
  helpMessage += "/connect - Connect to a wallet\n";
  helpMessage += "/my_wallet - Show connected wallet\n";
  helpMessage += "/help - Show this help message\n";
  
  if (userIsAdmin) {
    helpMessage += "\n*Admin commands:*\n";
    helpMessage += "/users - View all users\n";
    helpMessage += "/broadcast - Send message to all users\n";
    helpMessage += "/schedule - Schedule a message\n";
  }
  
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
}

function handleCallbackQuery(bot, callbackQuery, botId) {
  const chatId = callbackQuery.message.chat.id;
  const queryData = callbackQuery.data;
  
  console.log(`Received callback query: ${queryData}`);
  
  if (queryData === 'connect_wallet') {
    // Acknowledge the callback query
    bot.answerCallbackQuery(callbackQuery.id);
    
    // Simulate wallet connection
    const connector = getConnector(chatId, undefined, botId);
    connector.connect().then(() => {
      // Update user data
      updateUserData(chatId, botId, { 
        walletEverConnected: true,
        walletAddress: connector.wallet.account.address
      });
      
      bot.sendMessage(chatId, "✅ Wallet connected successfully! Use /my_wallet to see details.");
    }).catch(error => {
      console.error('Error connecting wallet:', error);
      bot.sendMessage(chatId, "❌ Error connecting wallet. Please try again.");
    });
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
