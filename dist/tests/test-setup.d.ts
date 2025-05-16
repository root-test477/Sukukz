/**
 * Test setup and utility functions
 */
/// <reference types="jest" />
import TelegramBot from 'node-telegram-bot-api';
declare const mockRedisClient: any;
declare const mockBot: {
    sendMessage: jest.Mock<any, any, any>;
    deleteMessage: jest.Mock<any, any, any>;
    editMessageText: jest.Mock<any, any, any>;
    onText: jest.Mock<any, any, any>;
    on: jest.Mock<any, any, any>;
    sendPhoto: jest.Mock<any, any, any>;
    setMyCommands: jest.Mock<any, any, any>;
};
/**
 * Reset all mocks between tests
 */
export declare function resetMocks(): void;
/**
 * Create a mock Telegram message
 */
export declare function createMockMessage(chatId: number, text?: string, from?: Partial<TelegramBot.User>): TelegramBot.Message;
/**
 * Create a mock callback query
 */
export declare function createMockCallbackQuery(chatId: number, data: string, messageId?: number): TelegramBot.CallbackQuery;
export { mockBot, mockRedisClient };
