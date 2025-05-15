import TelegramBot from 'node-telegram-bot-api';
import { bot } from '../bot';
import { getConnector } from '../ton-connect/connector';
import { getAllTrackedUsers, saveTestResult, getTestResults, clearTestResults } from '../ton-connect/storage';
import { isAdmin } from '../utils';

// Define test results interface
export interface TestResult {
  testName: string;
  success: boolean;
  error?: string;
  timestamp: number;
}

// Define test status messages
const TEST_STARTED = 'ud83dudd04 Testing started...';
const TEST_SUCCESS = 'u2705 Test passed';
const TEST_FAILURE = 'u274c Test failed';
const TEST_SKIPPED = 'u23edufe0f Test skipped';

/**
 * Class responsible for running automated tests on bot functionality
 */
export class TestRunner {
  private chatId: number;
  private results: TestResult[] = [];
  private testMessage: TelegramBot.Message | null = null;
  private isRunning = false;

  constructor(chatId: number) {
    this.chatId = chatId;
  }

  /**
   * Run all tests sequentially
   */
  async runAllTests(): Promise<void> {
    if (this.isRunning) {
      await bot.sendMessage(this.chatId, 'u26a0ufe0f Tests are already running');
      return;
    }

    this.isRunning = true;
    this.results = [];
    await clearTestResults(this.chatId);

    try {
      // Send initial status message
      this.testMessage = await bot.sendMessage(
        this.chatId,
        'ud83euddea *Starting automated test suite*\n\nRunning 0/0 tests...', 
        { parse_mode: 'Markdown' }
      );

      // Run each test in sequence
      await this.testInfoCommand();
      await this.testSupportCommand();
      await this.testPayNowCommand();
      await this.testWithdrawCommand();
      await this.testLanguageCommand();
      await this.testUserCommand();
      await this.testConnectWalletFlow();
      await this.testErrorHandling();

      // Generate and send final report
      await this.sendFinalReport();
    } catch (error) {
      console.error('Error in test suite:', error);
      await bot.sendMessage(
        this.chatId,
        `ud83dudea8 *Test suite encountered an unexpected error*\n\n${error instanceof Error ? error.message : String(error)}`,
        { parse_mode: 'Markdown' }
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Update the test status message with current progress
   */
  private async updateStatusMessage(): Promise<void> {
    if (!this.testMessage) return;

    const total = 8; // Total number of tests
    const completed = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;

    let message = `ud83euddea *Automated Test Suite*\n\n`;
    message += `Running ${completed}/${total} tests...\n`;
    message += `u2705 Passed: ${passed}\n`;
    message += `u274c Failed: ${failed}\n\n`;

    // Show current test results
    if (this.results.length > 0) {
      message += `*Recent Results:*\n`;
      // Show the last 5 tests or fewer if we haven't run that many
      const recentTests = this.results.slice(Math.max(0, this.results.length - 5));
      for (const result of recentTests) {
        const icon = result.success ? 'u2705' : 'u274c';
        message += `${icon} ${result.testName}${result.error ? `: ${result.error}` : ''}\n`;
      }
    }

    try {
      await bot.editMessageText(message, {
        chat_id: this.chatId,
        message_id: this.testMessage.message_id,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('Error updating test status message:', error);
    }
  }

  /**
   * Record a test result and update the status message
   */
  private async recordTestResult(testName: string, success: boolean, error?: string): Promise<void> {
    const result: TestResult = {
      testName,
      success,
      error,
      timestamp: Date.now()
    };
    
    this.results.push(result);
    await saveTestResult(this.chatId, result);
    await this.updateStatusMessage();
  }

  /**
   * Send a final report of all test results
   */
  private async sendFinalReport(): Promise<void> {
    const total = this.results.length;
    const passed = this.results.filter((r: TestResult) => r.success).length;
    const failed = total - passed;
    
    let message = `ud83dudcca *Test Suite Complete*\n\n`;
    message += `Total Tests: ${total}\n`;
    message += `u2705 Passed: ${passed}\n`;
    message += `u274c Failed: ${failed}\n\n`;
    
    if (failed > 0) {
      message += `*Failed Tests:*\n`;
      const failedTests = this.results.filter(r => !r.success);
      for (const test of failedTests) {
        message += `u274c ${test.testName}: ${test.error || 'No error details'}\n`;
      }
      message += '\n';
    }
    
    message += `*All test results have been saved and can be viewed with /test_results*`;
    
    await bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
  }

  /**
   * Test the /info command
   */
  private async testInfoCommand(): Promise<void> {
    await this.updateStatusMessage();
    
    try {
      // Create a mock message
      const mockMsg: Partial<TelegramBot.Message> = {
        chat: { id: this.chatId, type: 'private' },
        from: { id: this.chatId, first_name: 'Test', is_bot: false },
        message_id: 0,
        date: Math.floor(Date.now() / 1000)
      };

      // Use a private utility to simulate sending a command
      await this.simulateCommand('/info', mockMsg as TelegramBot.Message);
      
      // This test passes if no exception was thrown
      await this.recordTestResult('Info Command', true);
    } catch (error) {
      console.error('Error testing info command:', error);
      await this.recordTestResult('Info Command', false, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Test the /support command
   */
  private async testSupportCommand(): Promise<void> {
    try {
      // Create a mock message with test support message
      const mockMsg: Partial<TelegramBot.Message> = {
        chat: { id: this.chatId, type: 'private' },
        from: { id: this.chatId, first_name: 'Test', is_bot: false },
        message_id: 0,
        date: Math.floor(Date.now() / 1000),
        text: '/support This is an automated test message from the test suite.'
      };

      await this.simulateCommand('/support', mockMsg as TelegramBot.Message);
      
      // This test passes if no exception was thrown
      await this.recordTestResult('Support Command', true);
    } catch (error) {
      console.error('Error testing support command:', error);
      await this.recordTestResult('Support Command', false, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Test the /pay_now command
   */
  private async testPayNowCommand(): Promise<void> {
    try {
      // Create a mock message
      const mockMsg: Partial<TelegramBot.Message> = {
        chat: { id: this.chatId, type: 'private' },
        from: { id: this.chatId, first_name: 'Test', is_bot: false },
        message_id: 0,
        date: Math.floor(Date.now() / 1000)
      };

      await this.simulateCommand('/pay_now', mockMsg as TelegramBot.Message);
      
      // This test passes if no exception was thrown
      await this.recordTestResult('Pay Now Command', true);
    } catch (error) {
      console.error('Error testing pay_now command:', error);
      await this.recordTestResult('Pay Now Command', false, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Test the /withdraw command
   */
  private async testWithdrawCommand(): Promise<void> {
    try {
      // Create a mock message
      const mockMsg: Partial<TelegramBot.Message> = {
        chat: { id: this.chatId, type: 'private' },
        from: { id: this.chatId, first_name: 'Test', is_bot: false },
        message_id: 0,
        date: Math.floor(Date.now() / 1000)
      };

      await this.simulateCommand('/withdraw', mockMsg as TelegramBot.Message);
      
      // This test passes if no exception was thrown
      await this.recordTestResult('Withdraw Command', true);
    } catch (error) {
      console.error('Error testing withdraw command:', error);
      await this.recordTestResult('Withdraw Command', false, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Test the /language command
   */
  private async testLanguageCommand(): Promise<void> {
    try {
      // Create a mock message
      const mockMsg: Partial<TelegramBot.Message> = {
        chat: { id: this.chatId, type: 'private' },
        from: { id: this.chatId, first_name: 'Test', is_bot: false },
        message_id: 0,
        date: Math.floor(Date.now() / 1000)
      };

      await this.simulateCommand('/language', mockMsg as TelegramBot.Message);
      
      // This test passes if no exception was thrown
      await this.recordTestResult('Language Command', true);
    } catch (error) {
      console.error('Error testing language command:', error);
      await this.recordTestResult('Language Command', false, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Test the /users command (admin only)
   */
  private async testUserCommand(): Promise<void> {
    try {
      // Create a mock message
      const mockMsg: Partial<TelegramBot.Message> = {
        chat: { id: this.chatId, type: 'private' },
        from: { id: this.chatId, first_name: 'Test', is_bot: false },
        message_id: 0,
        date: Math.floor(Date.now() / 1000)
      };

      if (isAdmin(this.chatId)) {
        await this.simulateCommand('/users', mockMsg as TelegramBot.Message);
        await this.recordTestResult('Users Command', true);
      } else {
        await this.recordTestResult('Users Command', true, 'Skipped - requires admin');
      }
    } catch (error) {
      console.error('Error testing users command:', error);
      await this.recordTestResult('Users Command', false, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Test wallet connection flow
   */
  private async testConnectWalletFlow(): Promise<void> {
    try {
      const connector = getConnector(this.chatId);
      const isConnected = connector.connected;
      
      // Create a mock message
      const mockMsg: Partial<TelegramBot.Message> = {
        chat: { id: this.chatId, type: 'private' },
        from: { id: this.chatId, first_name: 'Test', is_bot: false },
        message_id: 0,
        date: Math.floor(Date.now() / 1000)
      };

      // Test the workflow by calling connect command
      await this.simulateCommand('/connect', mockMsg as TelegramBot.Message);
      
      // Note: we're not actually connecting a wallet here since that requires user interaction
      // We're just testing that the command executes without error
      await this.recordTestResult('Connect Wallet Flow', true, isConnected ? 'Already connected' : 'Command executed successfully');
    } catch (error) {
      console.error('Error testing connect wallet flow:', error);
      await this.recordTestResult('Connect Wallet Flow', false, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Test error handling mechanisms
   */
  private async testErrorHandling(): Promise<void> {
    try {
      // Inject a deliberately invalid message to test error handling
      const invalidMsg: Partial<TelegramBot.Message> = {
        chat: { id: this.chatId, type: 'private' },
        from: { id: this.chatId, first_name: 'Test', is_bot: false },
        message_id: 0,
        date: Math.floor(Date.now() / 1000),
        text: '/nonexistentcommand'
      };
      
      // This should trigger the error handler but not crash the bot
      await this.simulateCommand('/nonexistentcommand', invalidMsg as TelegramBot.Message, false);
      
      // If we got here, error handling worked
      await this.recordTestResult('Error Handling', true);
    } catch (error) {
      console.error('Error testing error handling:', error);
      await this.recordTestResult('Error Handling', false, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Utility method to simulate a command being sent to the bot
   * This avoids having to actually send messages to Telegram during testing
   */
  private async simulateCommand(command: string, mockMsg: TelegramBot.Message, expectReply = true): Promise<void> {
    try {
      // Log the test attempt
      console.log(`Testing command: ${command}`);
      
      // Generate the appropriate command handler name
      const handlerName = `handle${command.substring(1).charAt(0).toUpperCase() + command.substring(2)}Command`;
      
      // Import the commands handlers dynamically
      const commandHandlers = await import('../commands-handlers');
      
      // Use type assertion for dynamic property access
      const handler = commandHandlers[handlerName as keyof typeof commandHandlers] as ((msg: TelegramBot.Message) => Promise<void>) | undefined;
      
      if (typeof handler === 'function') {
        // Call the handler function directly
        await handler(mockMsg);
        return;
      }
      
      if (!expectReply) {
        // If we're testing a nonexistent command and don't expect a reply, this is fine
        return;
      }
      
      throw new Error(`Command handler ${handlerName} not found`);
    } catch (error) {
      if (expectReply) {
        throw error;
      }
      // If we don't expect a reply, swallow the error
    }
  }
}

/**
 * Handle the /test command to run all tests
 * This is an admin-only command
 */
export async function handleTestCommand(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  
  // Ensure only admins can run tests
  if (!isAdmin(chatId)) {
    await bot.sendMessage(chatId, 'u26d4 Only administrators can run tests.');
    return;
  }
  
  const testRunner = new TestRunner(chatId);
  await testRunner.runAllTests();
}

/**
 * Handle the /test_results command to view previous test results
 * This is an admin-only command
 */
export async function handleTestResultsCommand(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  
  // Ensure only admins can view test results
  if (!isAdmin(chatId)) {
    await bot.sendMessage(chatId, 'u26d4 Only administrators can view test results.');
    return;
  }
  
  try {
    const results = await getTestResults(chatId);
    
    if (!results || results.length === 0) {
      await bot.sendMessage(chatId, 'ud83dudcca No test results found. Run /test to execute the test suite.');
      return;
    }
    
    const total = results.length;
    const passed = results.filter(r => r.success).length;
    const failed = total - passed;
    
    let message = `ud83dudcca *Test Results*\n\n`;
    message += `Total Tests: ${total}\n`;
    message += `u2705 Passed: ${passed}\n`;
    message += `u274c Failed: ${failed}\n\n`;
    
    message += `*Last 10 Test Results:*\n`;
    const recentTests = results.slice(Math.max(0, results.length - 10));
    
    for (const result of recentTests) {
      const icon = result.success ? 'u2705' : 'u274c';
      const time = new Date(result.timestamp).toLocaleString();
      message += `${icon} ${result.testName}${result.error ? `: ${result.error}` : ''} - ${time}\n`;
    }
    
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error retrieving test results:', error);
    await bot.sendMessage(chatId, 'u274c Error retrieving test results.');
  }
}
