import { withErrorHandling, handleErrorsCommand } from '../error-handler';
import { mockBot, mockRedisClient, resetMocks, createMockMessage } from './test-setup';
import { saveErrorReport } from '../ton-connect/storage';

// Mock the storage functions
jest.mock('../ton-connect/storage', () => ({
    getRedisClient: jest.fn().mockImplementation(() => mockRedisClient),
    saveErrorReport: jest.fn().mockResolvedValue(undefined)
}));

describe('Error Handler', () => {
    beforeEach(() => {
        resetMocks();
    });
    
    test('withErrorHandling should catch errors and send friendly message', async () => {
        // Create a function that throws an error
        const errorMessage = 'Test error';
        const errorFunction = jest.fn().mockImplementation(() => {
            throw new Error(errorMessage);
        });
        
        // Wrap it with error handling
        const wrappedFunction = withErrorHandling(errorFunction, 'test_command');
        
        // Create a mock message
        const mockMessage = createMockMessage(123456789, '/test_command');
        
        // Execute the wrapped function
        await wrappedFunction(mockMessage);
        
        // Verify the original function was called
        expect(errorFunction).toHaveBeenCalledWith(mockMessage);
        
        // Verify error was reported
        expect(saveErrorReport).toHaveBeenCalled();
        
        // Verify a friendly message was sent to the user
        expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
        expect(mockBot.sendMessage).toHaveBeenCalledWith(
            mockMessage.chat.id,
            expect.stringContaining('Something went wrong')
        );
    });
    
    test('handleErrorsCommand should fetch and display error reports', async () => {
        // Set up mock Redis response for error reports
        mockRedisClient.zRange.mockResolvedValue(['error1', 'error2']);
        mockRedisClient.hGetAll.mockImplementation((key: string) => {
            if (key === 'error:error1') {
                return Promise.resolve({
                    timestamp: new Date().toISOString(),
                    commandName: 'test_command',
                    userId: '123456789',
                    userMessage: '/test_command',
                    error: 'Test error 1'
                });
            } else if (key === 'error:error2') {
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
        const mockMessage = createMockMessage(123456789, '/errors 2');
        
        // Call the handler
        await handleErrorsCommand(mockMessage);
        
        // Verify the correct message was sent
        expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
        expect(mockBot.sendMessage).toHaveBeenCalledWith(
            mockMessage.chat.id,
            expect.stringContaining('Recent Error Reports'),
            expect.objectContaining({ parse_mode: 'Markdown' })
        );
    });
});
