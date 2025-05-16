import { ErrorHandler, ErrorType } from '../src/error-handler';

// Mock the bot to prevent actual API calls
jest.mock('../src/bot', () => ({
  bot: {
    sendMessage: jest.fn().mockResolvedValue({}),
    answerCallbackQuery: jest.fn().mockResolvedValue({}),
  },
}));

// Mock isAdmin utility
jest.mock('../src/utils', () => ({
  isAdmin: jest.fn().mockReturnValue(true),
}));

describe('ErrorHandler', () => {
  beforeEach(() => {
    // Clear mock calls between tests
    jest.clearAllMocks();
  });

  describe('handleError', () => {
    it('should log errors and add them to the errors array', () => {
      // Mock console.error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const errorDetails = {
        type: ErrorType.COMMAND_HANDLER,
        message: 'Test error message',
        command: 'test_command',
        userId: 123456,
        timestamp: Date.now(),
        stack: 'Test stack trace',
      };

      ErrorHandler.handleError(errorDetails);

      // Check if console.error was called
      expect(consoleSpy).toHaveBeenCalled();

      // Check if error was added to the array (use getRecentErrors to check)
      const recentErrors = ErrorHandler.getRecentErrors(1);
      expect(recentErrors.length).toBe(1);
      expect(recentErrors[0].message).toBe('Test error message');
      expect(recentErrors[0].command).toBe('test_command');

      // Restore console.error
      consoleSpy.mockRestore();
    });
  });

  describe('wrapCommandHandler', () => {
    it('should wrap a command handler with error handling', async () => {
      // Create a mock command handler that throws an error
      const mockHandler = jest.fn().mockImplementation(() => {
        throw new Error('Command error');
      });

      // Create a wrapped handler
      const wrappedHandler = ErrorHandler.wrapCommandHandler(mockHandler, 'test_command');

      // Mock message
      const mockMsg = {
        chat: { id: 123456 },
        from: { id: 654321 },
      };

      // Call the wrapped handler
      await wrappedHandler(mockMsg as any);

      // Check if the original handler was called
      expect(mockHandler).toHaveBeenCalledWith(mockMsg);

      // Check if an error message was sent to the user
      const bot = require('../src/bot').bot;
      expect(bot.sendMessage).toHaveBeenCalledWith(
        123456,
        expect.stringContaining('error occurred')
      );
    });
  });

  // Add more tests for other methods as needed
});
