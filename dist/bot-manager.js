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
exports.botManager = exports.BotManager = void 0;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const process = __importStar(require("process"));
// BotManager to handle multiple bot instances
class BotManager {
    constructor() {
        this.bots = new Map();
        this.configs = new Map();
        // Private constructor for singleton pattern
    }
    // Get singleton instance
    static getInstance() {
        if (!BotManager.instance) {
            BotManager.instance = new BotManager();
        }
        return BotManager.instance;
    }
    // Initialize all bots from environment variables
    initializeBots() {
        var _a;
        // Clear existing bots if reinitializing
        this.bots.clear();
        this.configs.clear();
        const DEBUG = process.env.DEBUG_MODE === 'true';
        // First, check for legacy single bot configuration
        if (process.env.TELEGRAM_BOT_TOKEN) {
            const adminIds = ((_a = process.env.ADMIN_IDS) === null || _a === void 0 ? void 0 : _a.split(',').map(id => Number(id.trim()))) || [];
            this.addBot({
                id: 'main',
                token: process.env.TELEGRAM_BOT_TOKEN,
                link: process.env.TELEGRAM_BOT_LINK || '',
                adminIds: adminIds,
                manifestUrl: process.env.MANIFEST_URL,
                recipientAddress: process.env.DEFAULT_RECIPIENT_ADDRESS
            });
            if (DEBUG) {
                console.log(`[BOT_MANAGER] Initialized legacy bot with ID: main`);
            }
        }
        // Then look for BOT_TOKEN_* pattern for multiple bots
        Object.keys(process.env).forEach(key => {
            var _a;
            // Match BOT_TOKEN_[ID] pattern
            const match = key.match(/^BOT_TOKEN_([A-Za-z0-9_]+)$/);
            if (match && match[1]) {
                const botId = match[1].toLowerCase();
                const token = process.env[key];
                // Skip if we already added this bot through legacy config
                if (botId === 'main' && this.bots.has('main')) {
                    return;
                }
                // Look for corresponding bot-specific settings
                const link = process.env[`BOT_LINK_${match[1]}`] || '';
                const adminIds = ((_a = process.env[`ADMIN_IDS_${match[1]}`]) === null || _a === void 0 ? void 0 : _a.split(',').map(id => Number(id.trim()))) || [];
                const manifestUrl = process.env[`MANIFEST_URL_${match[1]}`] || process.env.MANIFEST_URL;
                const recipientAddress = process.env[`DEFAULT_RECIPIENT_ADDRESS_${match[1]}`] || process.env.DEFAULT_RECIPIENT_ADDRESS;
                this.addBot({
                    id: botId,
                    token,
                    link,
                    adminIds,
                    manifestUrl,
                    recipientAddress
                });
                if (DEBUG) {
                    console.log(`[BOT_MANAGER] Initialized bot with ID: ${botId}`);
                }
            }
        });
        if (this.bots.size === 0) {
            console.error('[BOT_MANAGER] No bots were initialized! Check your environment variables.');
        }
        else if (DEBUG) {
            console.log(`[BOT_MANAGER] Total bots initialized: ${this.bots.size}`);
        }
    }
    // Add a bot instance with config
    addBot(config) {
        try {
            const bot = new node_telegram_bot_api_1.default(config.token, { polling: true });
            this.bots.set(config.id, bot);
            this.configs.set(config.id, config);
        }
        catch (error) {
            console.error(`[BOT_MANAGER] Failed to initialize bot ${config.id}:`, error);
        }
    }
    // Get a bot instance by ID
    getBot(botId) {
        return this.bots.get(botId);
    }
    // Get bot config by ID
    getBotConfig(botId) {
        return this.configs.get(botId);
    }
    // Get all bot instances
    getAllBots() {
        return this.bots;
    }
    // Get all bot configurations
    getAllBotConfigs() {
        return this.configs;
    }
    // Check if a user is an admin for a specific bot
    isAdmin(chatId, botId) {
        const config = this.configs.get(botId);
        if (!config)
            return false;
        return config.adminIds.includes(chatId);
    }
    // Get manifest URL for a specific bot
    getManifestUrl(botId) {
        var _a;
        return ((_a = this.configs.get(botId)) === null || _a === void 0 ? void 0 : _a.manifestUrl) || process.env.MANIFEST_URL || '';
    }
    // Get default recipient address for a specific bot
    getRecipientAddress(botId) {
        var _a;
        return ((_a = this.configs.get(botId)) === null || _a === void 0 ? void 0 : _a.recipientAddress) || process.env.DEFAULT_RECIPIENT_ADDRESS || '';
    }
}
exports.BotManager = BotManager;
// Singleton instance export
exports.botManager = BotManager.getInstance();
//# sourceMappingURL=bot-manager.js.map