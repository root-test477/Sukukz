import TelegramBot from 'node-telegram-bot-api';
export interface TestResult {
    testName: string;
    success: boolean;
    error?: string;
    timestamp: number;
}
/**
 * Class responsible for running automated tests on bot functionality
 */
export declare class TestRunner {
    private chatId;
    private results;
    private testMessage;
    private isRunning;
    constructor(chatId: number);
    /**
     * Sanitize message content to prevent Telegram formatting errors
     * This removes problematic characters that can cause parsing issues
     */
    private sanitizeMessage;
    /**
     * Run all tests sequentially
     */
    runAllTests(): Promise<void>;
    /**
     * Update the test status message with current progress
     */
    private updateStatusMessage;
    /**
     * Record a test result and update the status message
     */
    private recordTestResult;
    /**
     * Send a final report of all test results
     */
    private sendFinalReport;
    /**
     * Test the /info command
     */
    private testInfoCommand;
    /**
     * Test the /support command
     */
    private testSupportCommand;
    /**
     * Test the /pay_now command
     */
    private testPayNowCommand;
    /**
     * Test the /withdraw command
     */
    private testWithdrawCommand;
    /**
     * Test the /language command
     */
    private testLanguageCommand;
    /**
     * Test the /users command (admin only)
     */
    private testUserCommand;
    /**
     * Test wallet connection flow
     */
    private testConnectWalletFlow;
    /**
     * Test error handling mechanisms
     */
    private testErrorHandling;
    /**
     * Test the /tutorial command
     */
    private testTutorialCommand;
    /**
     * Utility method to simulate a command being sent to the bot
     * This avoids having to actually send messages to Telegram during testing
     */
    private simulateCommand;
}
/**
 * Handle the /test command to run all tests
 * This is an admin-only command
 */
export declare function handleTestCommand(msg: TelegramBot.Message): Promise<void>;
/**
 * Handle the /test_results command to view previous test results
 * This is an admin-only command
 */
export declare function handleTestResultsCommand(msg: TelegramBot.Message): Promise<void>;
