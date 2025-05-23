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
exports.BotFactory = void 0;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const process = __importStar(require("process"));
// Class to manage all bot instances
class BotFactory {
    constructor() {
        this.bots = new Map();
        this.configs = new Map();
        // Private constructor for singleton
    }
    // Get the singleton instance
    static getInstance() {
        if (!BotFactory.instance) {
            BotFactory.instance = new BotFactory();
        }
        return BotFactory.instance;
    }
    // Initialize all bots from environment variables
    initializeFromEnv() {
        var _a;
        // Get all bot tokens from environment variables (format: BOT_TOKEN_1, BOT_TOKEN_2, etc.)
        const envKeys = Object.keys(process.env);
        // Find all bot token entries
        const tokenKeys = envKeys.filter(key => key.match(/^BOT_TOKEN_\w+$/));
        console.log(`Found ${tokenKeys.length} bot tokens in environment variables`);
        // For each token, create a bot instance
        for (const tokenKey of tokenKeys) {
            const botId = tokenKey.replace('BOT_TOKEN_', '');
            const token = process.env[tokenKey];
            if (!token) {
                console.warn(`No token found for ${tokenKey}`);
                continue;
            }
            // Get admin IDs for this bot
            const adminIdsKey = `ADMIN_IDS_${botId}`;
            const adminIds = ((_a = process.env[adminIdsKey]) === null || _a === void 0 ? void 0 : _a.split(',').map(id => Number(id.trim()))) || [];
            // Get bot link
            const botLinkKey = `TELEGRAM_BOT_LINK_${botId}`;
            const botLink = process.env[botLinkKey] || '';
            // Get manifest URL
            const manifestUrlKey = `MANIFEST_URL_${botId}`;
            const manifestUrl = process.env[manifestUrlKey] || process.env.MANIFEST_URL || '';
            // Get withdraw URL
            const withdrawUrlKey = `WITHDRAW_URL_${botId}`;
            const withdrawUrl = process.env[withdrawUrlKey] || process.env.WITHDRAW_URL || '';
            // Get bot name
            const botNameKey = `BOT_NAME_${botId}`;
            const botName = process.env[botNameKey] || `Bot ${botId}`;
            // Create bot config
            const config = {
                id: botId,
                token,
                adminIds,
                name: botName,
                link: botLink,
                manifestUrl,
                withdrawUrl
            };
            // Create and store the bot instance
            this.createBot(config);
        }
        console.log(`Initialized ${this.bots.size} bot instances`);
    }
    // Create a bot instance with the given configuration
    createBot(config) {
        if (this.bots.has(config.id)) {
            console.log(`Bot with ID ${config.id} already exists, returning existing instance`);
            return this.bots.get(config.id);
        }
        // Check if any existing bot is already using this token
        // This prevents the 409 Conflict errors from Telegram
        for (const [existingId, existingConfig] of this.configs.entries()) {
            if (existingConfig.token === config.token) {
                console.warn(`Warning: Bot with ID ${config.id} is using the same token as ${existingId}`);
                console.warn(`To avoid polling conflicts, we'll reuse the existing bot instance.`);
                // Store a reference to the existing bot with the new ID
                const existingBot = this.bots.get(existingId);
                this.bots.set(config.id, existingBot);
                this.configs.set(config.id, config);
                return existingBot;
            }
        }
        console.log(`Creating new bot instance with ID ${config.id}`);
        // Create a new bot instance
        const bot = new node_telegram_bot_api_1.default(config.token, { polling: true });
        // Store the bot instance and its configuration
        this.bots.set(config.id, bot);
        this.configs.set(config.id, config);
        return bot;
    }
    // Get a bot instance by ID
    getBot(botId) {
        return this.bots.get(botId);
    }
    // Get all bot instances
    getAllBots() {
        return this.bots;
    }
    // Get bot configuration by ID
    getBotConfig(botId) {
        return this.configs.get(botId);
    }
    // Get all bot configurations
    getAllBotConfigs() {
        return this.configs;
    }
    // Check if a user is an admin for a specific bot
    isAdmin(botId, chatId) {
        const config = this.configs.get(botId);
        if (!config)
            return false;
        return config.adminIds.includes(chatId);
    }
}
exports.BotFactory = BotFactory;
//# sourceMappingURL=bot-factory.js.map