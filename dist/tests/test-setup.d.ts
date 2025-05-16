/**
 * Test setup and utility functions
 */
/// <reference types="jest" />
import TelegramBot from 'node-telegram-bot-api';
declare const mockRedisClient: {
    connect: jest.Mock<any, any, any>;
    isOpen: boolean;
    hSet: jest.Mock<any, any, any>;
    hGetAll: jest.Mock<any, any, any>;
    zAdd: jest.Mock<any, any, any>;
    zRange: jest.Mock<any, any, any>;
    get: jest.Mock<any, any, any>;
    set: jest.Mock<any, any, any>;
    exists: jest.Mock<any, any, any>;
    del: jest.Mock<any, any, any>;
    hDel: jest.Mock<any, any, any>;
    zRem: jest.Mock<any, any, any>;
    keys: jest.Mock<any, any, any>;
    lPush: jest.Mock<any, any, any>;
    lRange: jest.Mock<any, any, any>;
    quit: jest.Mock<any, any, any>;
    flushall: jest.Mock<any, any, any>;
};
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
