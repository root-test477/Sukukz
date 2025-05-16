"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const error_handler_1 = require("../error-handler");
const test_setup_1 = require("./test-setup");
const storage_1 = require("../ton-connect/storage");
// Mock the storage functions
jest.mock('../ton-connect/storage', () => ({
    getRedisClient: jest.fn().mockImplementation(() => test_setup_1.mockRedisClient),
    saveErrorReport: jest.fn().mockResolvedValue(undefined)
}));
describe('Error Handler', () => {
    beforeEach(() => {
        (0, test_setup_1.resetMocks)();
    });
    test('withErrorHandling should catch errors and send friendly message', () => __awaiter(void 0, void 0, void 0, function* () {
        // Create a function that throws an error
        const errorMessage = 'Test error';
        const errorFunction = jest.fn().mockImplementation(() => {
            throw new Error(errorMessage);
        });
        // Wrap it with error handling
        const wrappedFunction = (0, error_handler_1.withErrorHandling)(errorFunction, 'test_command');
        // Create a mock message
        const mockMessage = (0, test_setup_1.createMockMessage)(123456789, '/test_command');
        // Execute the wrapped function
        yield wrappedFunction(mockMessage);
        // Verify the original function was called
        expect(errorFunction).toHaveBeenCalledWith(mockMessage);
        // Verify error was reported
        expect(storage_1.saveErrorReport).toHaveBeenCalled();
        // Verify a friendly message was sent to the user
        expect(test_setup_1.mockBot.sendMessage).toHaveBeenCalledTimes(1);
        expect(test_setup_1.mockBot.sendMessage).toHaveBeenCalledWith(mockMessage.chat.id, expect.stringContaining('Something went wrong'));
    }));
    test('handleErrorsCommand should fetch and display error reports', () => __awaiter(void 0, void 0, void 0, function* () {
        // Set up mock Redis response for error reports
        test_setup_1.mockRedisClient.zRange.mockResolvedValue(['error1', 'error2']);
        test_setup_1.mockRedisClient.hGetAll.mockImplementation((key) => {
            if (key === 'error:error1') {
                return Promise.resolve({
                    timestamp: new Date().toISOString(),
                    commandName: 'test_command',
                    userId: '123456789',
                    userMessage: '/test_command',
                    error: 'Test error 1'
                });
            }
            else if (key === 'error:error2') {
                return Promise.resolve({
                    timestamp: new Date().toISOString(),
                    commandName: 'other_command',
                    userId: '987654321',
                    userMessage: '/other_command',
                    error: 'Test error 2'
                });
            }
            return Promise.resolve({});
        });
        // Create a mock message for admin
        process.env.ADMIN_IDS = '123456789';
        const mockMessage = (0, test_setup_1.createMockMessage)(123456789, '/errors 2');
        // Call the handler
        yield (0, error_handler_1.handleErrorsCommand)(mockMessage);
        // Verify the correct message was sent
        expect(test_setup_1.mockBot.sendMessage).toHaveBeenCalledTimes(1);
        expect(test_setup_1.mockBot.sendMessage).toHaveBeenCalledWith(mockMessage.chat.id, expect.stringContaining('Recent Error Reports'), expect.objectContaining({ parse_mode: 'Markdown' }));
    }));
});
//# sourceMappingURL=error-handler.test.js.map