import TelegramBot from 'node-telegram-bot-api';
export interface BotConfig {
    id: string;
    token: string;
    adminIds: number[];
    name?: string;
    link?: string;
    manifestUrl?: string;
    withdrawUrl?: string;
}
export declare class BotFactory {
    private static instance;
    private bots;
    private configs;
    private constructor();
    static getInstance(): BotFactory;
    initializeFromEnv(): void;
    createBot(config: BotConfig): TelegramBot;
    getBot(botId: string): TelegramBot | undefined;
    getAllBots(): Map<string, TelegramBot>;
    getBotConfig(botId: string): BotConfig | undefined;
    getAllBotConfigs(): Map<string, BotConfig>;
    isAdmin(botId: string, chatId: number): boolean;
}
