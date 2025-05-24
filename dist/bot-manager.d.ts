import TelegramBot from 'node-telegram-bot-api';
export interface BotConfig {
    id: string;
    token: string;
    link: string;
    adminIds: number[];
    manifestUrl?: string;
    recipientAddress?: string;
}
export declare class BotManager {
    private static instance;
    private bots;
    private configs;
    private constructor();
    static getInstance(): BotManager;
    initializeBots(): void;
    private addBot;
    getBot(botId: string): TelegramBot | undefined;
    getBotConfig(botId: string): BotConfig | undefined;
    getAllBots(): Map<string, TelegramBot>;
    getAllBotConfigs(): Map<string, BotConfig>;
    isAdmin(chatId: number, botId: string): boolean;
    getManifestUrl(botId: string): string;
    getRecipientAddress(botId: string): string;
}
export declare const botManager: BotManager;
