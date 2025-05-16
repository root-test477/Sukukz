/**
 * Test setup and utility functions
 */

import { createClient } from 'redis-mock';
import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';

// Mock environment variables for testing
dotenv.config({ path: '.env.test' });

// Mock Redis client
const mockRedisClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    isOpen: true,
    hSet: jest.fn().mockResolvedValue(undefined),
    hGetAll: jest.fn().mockResolvedValue({}),
    zAdd: jest.fn().mockResolvedValue(1),
    zRange: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    exists: jest.fn().mockResolvedValue(0),
    del: jest.fn().mockResolvedValue(1),
    hDel: jest.fn().mockResolvedValue(1),
    zRem: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    lPush: jest.fn().mockResolvedValue(1),
    lRange: jest.fn().mockResolvedValue([]),
    quit: jest.fn().mockResolvedValue(undefined),
    flushall: jest.fn().mockResolvedValue('OK')
};

// Mock the Redis import in storage.ts
jest.mock('redis', () => {
    return {
        createClient: jest.fn().mockImplementation(() => mockRedisClient)
    };
});

// Mock Telegram Bot
const mockBot = {
    sendMessage: jest.fn().mockResolvedValue({}),
    deleteMessage: jest.fn().mockResolvedValue(true),
    editMessageText: jest.fn().mockResolvedValue({}),
    onText: jest.fn(),
    on: jest.fn(),
    sendPhoto: jest.fn().mockResolvedValue({}),
    setMyCommands: jest.fn().mockResolvedValue(true)
};

// Mock the bot import in other modules
jest.mock('../bot', () => {
    return { bot: mockBot };
});

/**
 * Reset all mocks between tests
 */
export function resetMocks(): void {
    jest.clearAllMocks();
    mockRedisClient.flushall();
}

/**
 * Create a mock Telegram message
 */
export function createMockMessage(chatId: number, text: string = '', from: Partial<TelegramBot.User> = {}): TelegramBot.Message {
    return {
        message_id: Math.floor(Math.random() * 1000),
        chat: { id: chatId, type: 'private', first_name: 'Test', last_name: 'User' },
        date: Math.floor(Date.now() / 1000),
        text,
        from: {
            id: chatId,
            is_bot: false,
            first_name: 'Test',
            last_name: 'User',
            ...from
        }
    } as TelegramBot.Message;
}

/**
 * Create a mock callback query
 */
export function createMockCallbackQuery(
    chatId: number,
    data: string,
    messageId: number = Math.floor(Math.random() * 1000)
): TelegramBot.CallbackQuery {
    return {
        id: `query_${Math.floor(Math.random() * 1000)}`,
        from: { id: chatId, is_bot: false, first_name: 'Test', last_name: 'User' },
        message: {
            message_id: messageId,
            chat: { id: chatId, type: 'private', first_name: 'Test', last_name: 'User' },
            date: Math.floor(Date.now() / 1000)
        } as TelegramBot.Message,
        chat_instance: `chat_${chatId}`,
        data
    } as TelegramBot.CallbackQuery;
}

// Export mocks for use in tests
export { mockBot, mockRedisClient };
