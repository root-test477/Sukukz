import TelegramBot from 'node-telegram-bot-api';
interface BotInstance {
    bot: TelegramBot;
    id: string;
    name: string;
}
export declare const bot: TelegramBot;
export declare const bots: Map<string, BotInstance>;
export declare function setupBotCommunication(): void;
export declare function handleWebhookRequest(botId: string, update: any): boolean;
export declare function getBotById(botId: string): TelegramBot | undefined;
export declare function getAllBots(): BotInstance[];
export declare function getWebhookPath(botId: string): string;
export declare function isWebhookPath(path: string): {
    isWebhook: boolean;
    botId: string | null;
};
export {};
