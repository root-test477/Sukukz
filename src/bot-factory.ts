import TelegramBot from 'node-telegram-bot-api';
import * as process from 'process';

// Type definition for a bot configuration
export interface BotConfig {
    id: string;
    token: string;
    adminIds: number[];
    name?: string;
    link?: string;
    manifestUrl?: string;
    withdrawUrl?: string;
}

// Class to manage all bot instances
export class BotFactory {
    private static instance: BotFactory;
    private bots: Map<string, TelegramBot> = new Map();
    private configs: Map<string, BotConfig> = new Map();
    
    private constructor() {
        // Private constructor for singleton
    }
    
    // Get the singleton instance
    public static getInstance(): BotFactory {
        if (!BotFactory.instance) {
            BotFactory.instance = new BotFactory();
        }
        return BotFactory.instance;
    }
    
    // Initialize all bots from environment variables
    public initializeFromEnv(): void {
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
            const adminIds = process.env[adminIdsKey]?.split(',').map(id => Number(id.trim())) || [];
            
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
            const config: BotConfig = {
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
    public createBot(config: BotConfig): TelegramBot {
        if (this.bots.has(config.id)) {
            console.log(`Bot with ID ${config.id} already exists, returning existing instance`);
            return this.bots.get(config.id)!;
        }
        
        // Check if any existing bot is already using this token
        // This prevents the 409 Conflict errors from Telegram
        for (const [existingId, existingConfig] of this.configs.entries()) {
            if (existingConfig.token === config.token) {
                console.warn(`Warning: Bot with ID ${config.id} is using the same token as ${existingId}`);
                console.warn(`To avoid polling conflicts, we'll reuse the existing bot instance.`);
                
                // Store a reference to the existing bot with the new ID
                const existingBot = this.bots.get(existingId)!;
                this.bots.set(config.id, existingBot);
                this.configs.set(config.id, config);
                
                return existingBot;
            }
        }
        
        console.log(`Creating new bot instance with ID ${config.id}`);
        
        // Create a new bot instance
        const bot = new TelegramBot(config.token, { polling: true });
        
        // Store the bot instance and its configuration
        this.bots.set(config.id, bot);
        this.configs.set(config.id, config);
        
        return bot;
    }
    
    // Get a bot instance by ID
    public getBot(botId: string): TelegramBot | undefined {
        return this.bots.get(botId);
    }
    
    // Get all bot instances
    public getAllBots(): Map<string, TelegramBot> {
        return this.bots;
    }
    
    // Get bot configuration by ID
    public getBotConfig(botId: string): BotConfig | undefined {
        return this.configs.get(botId);
    }
    
    // Get all bot configurations
    public getAllBotConfigs(): Map<string, BotConfig> {
        return this.configs;
    }
    
    // Check if a user is an admin for a specific bot
    public isAdmin(botId: string, chatId: number): boolean {
        const config = this.configs.get(botId);
        if (!config) return false;
        
        return config.adminIds.includes(chatId);
    }
}
