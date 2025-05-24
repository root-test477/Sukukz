// Script to manually register webhooks for Telegram bots
require('dotenv').config();
const axios = require('axios');

// Function to register a webhook for a bot
async function registerWebhook(botToken, botId) {
  const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://root-test477.onrender.com';
  const webhookPath = `/webhook/${botId}`;
  const webhookUrl = `${baseUrl}${webhookPath}`;
  const secretToken = process.env.WEBHOOK_SECRET_TOKEN || 'your-secure-token-here';
  
  console.log(`Registering webhook for bot ${botId} to ${webhookUrl}`);
  
  try {
    // First, delete any existing webhook
    const deleteUrl = `https://api.telegram.org/bot${botToken}/deleteWebhook`;
    await axios.get(deleteUrl);
    console.log(`✓ Deleted existing webhook for bot ${botId}`);
    
    // Wait a moment before setting a new webhook
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Register the new webhook with max_connections and drop_pending_updates
    const setUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;
    const response = await axios.post(setUrl, {
      url: webhookUrl,
      secret_token: secretToken,
      max_connections: 40,
      drop_pending_updates: true
    });
    
    if (response.data && response.data.ok) {
      console.log(`✓ Successfully registered webhook for bot ${botId}`);
      
      // Get webhook info to verify
      const infoUrl = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;
      const info = await axios.get(infoUrl);
      console.log(`Webhook info for bot ${botId}:`, JSON.stringify(info.data, null, 2));
    } else {
      console.error(`✗ Failed to register webhook for bot ${botId}:`, response.data);
    }
  } catch (error) {
    console.error(`✗ Error registering webhook for bot ${botId}:`, error.message);
  }
}

// Main function to register webhooks for all bots
async function main() {
  // Get all bot tokens from environment variables
  const tokens = [];
  
  // Check for multi-bot configuration
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('BOT_TOKEN_')) {
      const botId = key.replace('BOT_TOKEN_', '');
      const token = process.env[key];
      if (token) {
        tokens.push({ id: botId, token });
      }
    }
  }
  
  // Check for legacy single bot configuration
  if (process.env.TELEGRAM_BOT_TOKEN) {
    tokens.push({ id: 'legacy', token: process.env.TELEGRAM_BOT_TOKEN });
  }
  
  console.log(`Found ${tokens.length} bot tokens to register webhooks for`);
  
  // Register webhooks for all bots
  for (const bot of tokens) {
    await registerWebhook(bot.token, bot.id);
    // Wait a moment between registrations to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('Done registering webhooks');
}

// Run the main function
main().catch(console.error);
