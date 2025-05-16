"use strict";
/**
 * Test setup and utility functions
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockRedisClient = exports.mockBot = exports.createMockCallbackQuery = exports.createMockMessage = exports.resetMocks = void 0;
const redis_mock_1 = require("redis-mock");
const dotenv = __importStar(require("dotenv"));
// Mock environment variables for testing
dotenv.config({ path: '.env.test' });
// Mock Redis client
const mockRedisClient = (0, redis_mock_1.createClient)();
exports.mockRedisClient = mockRedisClient;
// Mock the Redis import in storage.ts
jest.mock('redis', () => {
    return {
        createClient: jest.fn().mockImplementation(() => mockRedisClient)
    };
});
// Mock Telegram Bot
const mockBot = {
    sendMessage: jest.fn(),
    deleteMessage: jest.fn(),
    editMessageText: jest.fn(),
    onText: jest.fn(),
    on: jest.fn(),
    sendPhoto: jest.fn(),
    setMyCommands: jest.fn()
};
exports.mockBot = mockBot;
// Mock the bot import in other modules
jest.mock('../bot', () => {
    return {
        bot: mockBot
    };
});
/**
 * Reset all mocks between tests
 */
function resetMocks() {
    jest.clearAllMocks();
    // Clear Redis mock data
    mockRedisClient.flushall();
}
exports.resetMocks = resetMocks;
/**
 * Create a mock Telegram message
 */
function createMockMessage(chatId, text = '', from = {}) {
    return {
        message_id: Math.floor(Math.random() * 1000),
        chat: { id: chatId, type: 'private', first_name: 'Test', last_name: 'User' },
        date: Math.floor(Date.now() / 1000),
        text,
        from: Object.assign({ id: chatId, is_bot: false, first_name: 'Test', last_name: 'User' }, from)
    };
}
exports.createMockMessage = createMockMessage;
/**
 * Create a mock callback query
 */
function createMockCallbackQuery(chatId, data, messageId = Math.floor(Math.random() * 1000)) {
    return {
        id: `query_${Math.floor(Math.random() * 1000)}`,
        from: { id: chatId, is_bot: false, first_name: 'Test', last_name: 'User' },
        message: {
            message_id: messageId,
            chat: { id: chatId, type: 'private', first_name: 'Test', last_name: 'User' },
            date: Math.floor(Date.now() / 1000)
        },
        chat_instance: `chat_${chatId}`,
        data
    };
}
exports.createMockCallbackQuery = createMockCallbackQuery;
//# sourceMappingURL=test-setup.js.map