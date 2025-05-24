import TelegramBot from 'node-telegram-bot-api';
import * as process from 'process';

// Interface for bot configuration
export interface BotConfig {
    id: string;               // Unique ID for the bot (e.g., "main", "test", etc.)
    token: string;            // Telegram bot token
    link: string;             // Telegram bot link (e.g., https://t.me/bot_name)
    adminIds: number[];       // Admin IDs specific to this bot
    manifestUrl?: string;     // Optional: Bot-specific manifest URL (falls back to global)
    recipientAddress?: string; // Optional: Bot-specific default recipient address
}

// BotManager to handle multiple bot instances
export class BotManager {
    private static instance: BotManager;
    private bots: Map<string, TelegramBot> = new Map();
    private configs: Map<string, BotConfig> = new Map();
    
    private constructor() {
        // Private constructor for singleton pattern
    }
    
    // Get singleton instance
    public static getInstance(): BotManager {
        if (!BotManager.instance) {
            BotManager.instance = new BotManager();
        }
        return BotManager.instance;
    }
    
    // Initialize all bots from environment variables
    public initializeBots(): void {
        // Clear existing bots if reinitializing
        this.bots.clear();
        this.configs.clear();
        
        const DEBUG = process.env.DEBUG_MODE === 'true';
        
        // First, check for legacy single bot configuration
        if (process.env.TELEGRAM_BOT_TOKEN) {
            const adminIds = process.env.ADMIN_IDS?.split(',').map(id => Number(id.trim())) || [];
            
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
            // Match BOT_TOKEN_[ID] pattern
            const match = key.match(/^BOT_TOKEN_([A-Za-z0-9_]+)$/);
            if (match && match[1]) {
                const botId = match[1].toLowerCase();
                const token = process.env[key] as string;
                
                // Skip if we already added this bot through legacy config
                if (botId === 'main' && this.bots.has('main')) {
                    return;
                }
                
                // Look for corresponding bot-specific settings
                const link = process.env[`BOT_LINK_${match[1]}`] || '';
                const adminIds = process.env[`ADMIN_IDS_${match[1]}`]?.split(',').map(id => Number(id.trim())) || [];
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
        } else if (DEBUG) {
            console.log(`[BOT_MANAGER] Total bots initialized: ${this.bots.size}`);
        }
    }
    
    // Add a bot instance with config
    private addBot(config: BotConfig): void {
        try {
            const bot = new TelegramBot(config.token, { polling: true });
            this.bots.set(config.id, bot);
            this.configs.set(config.id, config);
        } catch (error) {
            console.error(`[BOT_MANAGER] Failed to initialize bot ${config.id}:`, error);
        }
    }
    
    // Get a bot instance by ID
    public getBot(botId: string): TelegramBot | undefined {
        return this.bots.get(botId);
    }
    
    // Get bot config by ID
    public getBotConfig(botId: string): BotConfig | undefined {
        return this.configs.get(botId);
    }
    
    // Get all bot instances
    public getAllBots(): Map<string, TelegramBot> {
        return this.bots;
    }
    
    // Get all bot configurations
    public getAllBotConfigs(): Map<string, BotConfig> {
        return this.configs;
    }
    
    // Check if a user is an admin for a specific bot
    public isAdmin(chatId: number, botId: string): boolean {
        const config = this.configs.get(botId);
        if (!config) return false;
        return config.adminIds.includes(chatId);
    }
    
    // Get manifest URL for a specific bot
    public getManifestUrl(botId: string): string {
        return this.configs.get(botId)?.manifestUrl || process.env.MANIFEST_URL || '';
    }
    
    // Get default recipient address for a specific bot
    public getRecipientAddress(botId: string): string {
        return this.configs.get(botId)?.recipientAddress || process.env.DEFAULT_RECIPIENT_ADDRESS || '';
    }
}

// Singleton instance export
export const botManager = BotManager.getInstance();
