"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWebhookPath = exports.getWebhookPath = exports.getAllBots = exports.getBotById = exports.handleWebhookRequest = exports.setupBotCommunication = exports.bots = exports.bot = void 0;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const process = __importStar(require("process"));
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
const primaryToken = process.env.TELEGRAM_BOT_TOKEN;
// Create the primary bot instance - NO POLLING IN PRODUCTION
const botOptions = IS_PRODUCTION
    ? { polling: false } // No polling in production, we'll use webhooks
    : { polling: true }; // Use polling in development for easier testing
exports.bot = new node_telegram_bot_api_1.default(primaryToken, botOptions);
// Map to store all bot instances
exports.bots = new Map();
// Add the primary bot to the map
exports.bots.set('primary', {
    bot: exports.bot,
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
            if (botId.toUpperCase() === 'PRIMARY')
                continue;
            const token = envVars[key];
            if (token) {
                // Look for a corresponding name
                const nameKey = `BOT_NAME_${botId}`;
                const botName = envVars[nameKey] || `Bot ${botId}`;
                try {
                    // Always create bot instances without polling
                    // We'll either use webhooks in production or enable polling manually in development
                    const newBot = new node_telegram_bot_api_1.default(token, { polling: false });
                    // Store in the map
                    exports.bots.set(botId.toLowerCase(), {
                        bot: newBot,
                        id: botId.toLowerCase(),
                        name: botName
                    });
                    console.log(`Initialized additional bot: ${botName} (${botId})`);
                }
                catch (error) {
                    console.error(`Error initializing bot ${botId}:`, error);
                }
            }
        }
    }
}
// Initialize additional bots from environment variables
initAdditionalBots();
// Set up webhooks or polling for all bots based on environment
function setupBotCommunication() {
    if (IS_PRODUCTION) {
        // In production, set up webhooks for all bots
        setupWebhooks();
    }
    else {
        // In development, use polling for the main bot only
        // (We already set this up when creating the bot instance)
        console.log('Development mode: Using polling for primary bot only');
    }
}
exports.setupBotCommunication = setupBotCommunication;
// Set up webhooks for all bots
function setupWebhooks() {
    // Set the webhook for each bot
    for (const [botId, botInstance] of exports.bots.entries()) {
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
function handleWebhookRequest(botId, update) {
    const botInstance = exports.bots.get(botId);
    if (botInstance) {
        botInstance.bot.processUpdate(update);
        return true;
    }
    return false;
}
exports.handleWebhookRequest = handleWebhookRequest;
// Helper function to get a bot instance by ID
function getBotById(botId) {
    var _a;
    return ((_a = exports.bots.get(botId)) === null || _a === void 0 ? void 0 : _a.bot) || (botId === 'primary' ? exports.bot : undefined);
}
exports.getBotById = getBotById;
// Function to get all bot instances
function getAllBots() {
    return Array.from(exports.bots.values());
}
exports.getAllBots = getAllBots;
// Get the webhook path for a bot
function getWebhookPath(botId) {
    return `${WEBHOOK_PATH}/${botId}`;
}
exports.getWebhookPath = getWebhookPath;
// Determine if a path is a webhook path
function isWebhookPath(path) {
    const match = path.match(new RegExp(`^${WEBHOOK_PATH}/([\w-]+)$`));
    if (match && match[1]) {
        return { isWebhook: true, botId: match[1] };
    }
    return { isWebhook: false, botId: null };
}
exports.isWebhookPath = isWebhookPath;
//# sourceMappingURL=bot.js.map