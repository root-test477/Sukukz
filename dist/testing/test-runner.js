"use strict";
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
exports.handleTestResultsCommand = exports.handleTestCommand = exports.TestRunner = void 0;
const bot_1 = require("../bot");
const connector_1 = require("../ton-connect/connector");
const storage_1 = require("../ton-connect/storage");
const utils_1 = require("../utils");
// Define test status messages
const TEST_STARTED = 'ud83dudd04 Testing started...';
const TEST_SUCCESS = 'u2705 Test passed';
const TEST_FAILURE = 'u274c Test failed';
const TEST_SKIPPED = 'u23edufe0f Test skipped';
/**
 * Class responsible for running automated tests on bot functionality
 */
class TestRunner {
    constructor(chatId) {
        this.results = [];
        this.testMessage = null;
        this.isRunning = false;
        this.chatId = chatId;
    }
    /**
     * Sanitize message content to prevent Telegram formatting errors
     * This removes problematic characters that can cause parsing issues
     */
    sanitizeMessage(text) {
        // Simple approach to avoid syntax errors - direct string manipulation
        let sanitized = text;
        // Replace HTML tags
        sanitized = sanitized.replace(/</g, '&lt;');
        sanitized = sanitized.replace(/>/g, '&gt;');
        // Replace markdown formatting characters
        sanitized = sanitized.replace(/\*/g, '*');
        sanitized = sanitized.replace(/`/g, "'");
        sanitized = sanitized.replace(/\[/g, '(');
        sanitized = sanitized.replace(/\]/g, ')');
        // Convert emoji codes to simple text alternatives
        sanitized = sanitized.replace(/u2705/g, '[OK]');
        sanitized = sanitized.replace(/u274c/g, '[X]');
        sanitized = sanitized.replace(/ud83euddea/g, '[TEST]');
        sanitized = sanitized.replace(/ud83dudea8/g, '[ALERT]');
        sanitized = sanitized.replace(/ud83dudcca/g, '[STATS]');
        return sanitized;
    }
    /**
     * Run all tests sequentially
     */
    runAllTests() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRunning) {
                yield bot_1.bot.sendMessage(this.chatId, 'u26a0ufe0f Tests are already running');
                return;
            }
            this.isRunning = true;
            this.results = [];
            yield (0, storage_1.clearTestResults)(this.chatId);
            try {
                // Send initial status message
                this.testMessage = yield bot_1.bot.sendMessage(this.chatId, 'ud83euddea *Starting automated test suite*\n\nRunning 0/0 tests...', { parse_mode: 'Markdown' });
                // Run each test in sequence
                yield this.testInfoCommand();
                yield this.testSupportCommand();
                yield this.testPayNowCommand();
                yield this.testWithdrawCommand();
                yield this.testLanguageCommand();
                yield this.testUserCommand();
                yield this.testConnectWalletFlow();
                yield this.testErrorHandling();
                yield this.testTutorialCommand();
                // Generate and send final report
                yield this.sendFinalReport();
            }
            catch (error) {
                console.error('Error in test suite:', error);
                yield bot_1.bot.sendMessage(this.chatId, `ud83dudea8 *Test suite encountered an unexpected error*\n\n${error instanceof Error ? error.message : String(error)}`, { parse_mode: 'Markdown' });
            }
            finally {
                this.isRunning = false;
            }
        });
    }
    /**
     * Update the test status message with current progress
     */
    updateStatusMessage() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.testMessage)
                return;
            const total = 8; // Total number of tests
            const completed = this.results.length;
            const passed = this.results.filter(r => r.success).length;
            const failed = this.results.filter(r => !r.success).length;
            // Using plain text rather than formatting to avoid Telegram parsing errors
            let message = `🧪 Automated Test Suite

`;
            message += `Running ${completed}/${total} tests...
`;
            message += `✅ Passed: ${passed}
`;
            message += `❌ Failed: ${failed}

`;
            // Show current test results
            if (this.results.length > 0) {
                message += `Recent Results:
`;
                // Show the last 5 tests or fewer if we haven't run that many
                const recentTests = this.results.slice(Math.max(0, this.results.length - 5));
                for (const result of recentTests) {
                    const icon = result.success ? '✅' : '❌';
                    message += `${icon} ${result.testName}${result.error ? `: ${result.error}` : ''}
`;
                }
            }
            // Sanitize the message to prevent formatting errors
            const safeText = this.sanitizeMessage(message);
            try {
                yield bot_1.bot.editMessageText(safeText, {
                    chat_id: this.chatId,
                    message_id: this.testMessage.message_id,
                    parse_mode: undefined, // Don't use parse_mode to avoid formatting issues
                });
            }
            catch (error) {
                console.error('Error updating test status message:', error);
            }
        });
    }
    /**
     * Record a test result and update the status message
     */
    recordTestResult(testName, success, error) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = {
                testName,
                success,
                error,
                timestamp: Date.now()
            };
            this.results.push(result);
            yield (0, storage_1.saveTestResult)(this.chatId, result);
            yield this.updateStatusMessage();
        });
    }
    /**
     * Send a final report of all test results
     */
    sendFinalReport() {
        return __awaiter(this, void 0, void 0, function* () {
            const total = this.results.length;
            const passed = this.results.filter((r) => r.success).length;
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
            yield bot_1.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
        });
    }
    /**
     * Test the /info command
     */
    testInfoCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.updateStatusMessage();
            try {
                // Create a mock message
                const mockMsg = {
                    chat: { id: this.chatId, type: 'private' },
                    from: { id: this.chatId, first_name: 'Test', is_bot: false },
                    message_id: 0,
                    date: Math.floor(Date.now() / 1000)
                };
                // Use a private utility to simulate sending a command
                yield this.simulateCommand('/info', mockMsg);
                // This test passes if no exception was thrown
                yield this.recordTestResult('Info Command', true);
            }
            catch (error) {
                console.error('Error testing info command:', error);
                yield this.recordTestResult('Info Command', false, error instanceof Error ? error.message : String(error));
            }
        });
    }
    /**
     * Test the /support command
     */
    testSupportCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Create a mock message with test support message
                const mockMsg = {
                    chat: { id: this.chatId, type: 'private' },
                    from: { id: this.chatId, first_name: 'Test', is_bot: false },
                    message_id: 0,
                    date: Math.floor(Date.now() / 1000),
                    text: '/support This is an automated test message from the test suite.'
                };
                yield this.simulateCommand('/support', mockMsg);
                // This test passes if no exception was thrown
                yield this.recordTestResult('Support Command', true);
            }
            catch (error) {
                console.error('Error testing support command:', error);
                yield this.recordTestResult('Support Command', false, error instanceof Error ? error.message : String(error));
            }
        });
    }
    /**
     * Test the /pay_now command
     */
    testPayNowCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Create a mock message
                const mockMsg = {
                    chat: { id: this.chatId, type: 'private' },
                    from: { id: this.chatId, first_name: 'Test', is_bot: false },
                    message_id: 0,
                    date: Math.floor(Date.now() / 1000)
                };
                yield this.simulateCommand('/pay_now', mockMsg);
                // This test passes if no exception was thrown
                yield this.recordTestResult('Pay Now Command', true);
            }
            catch (error) {
                console.error('Error testing pay_now command:', error);
                yield this.recordTestResult('Pay Now Command', false, error instanceof Error ? error.message : String(error));
            }
        });
    }
    /**
     * Test the /withdraw command
     */
    testWithdrawCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Create a mock message
                const mockMsg = {
                    chat: { id: this.chatId, type: 'private' },
                    from: { id: this.chatId, first_name: 'Test', is_bot: false },
                    message_id: 0,
                    date: Math.floor(Date.now() / 1000)
                };
                yield this.simulateCommand('/withdraw', mockMsg);
                // This test passes if no exception was thrown
                yield this.recordTestResult('Withdraw Command', true);
            }
            catch (error) {
                console.error('Error testing withdraw command:', error);
                yield this.recordTestResult('Withdraw Command', false, error instanceof Error ? error.message : String(error));
            }
        });
    }
    /**
     * Test the /language command
     */
    testLanguageCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Create a mock message
                const mockMsg = {
                    chat: { id: this.chatId, type: 'private' },
                    from: { id: this.chatId, first_name: 'Test', is_bot: false },
                    message_id: 0,
                    date: Math.floor(Date.now() / 1000)
                };
                yield this.simulateCommand('/language', mockMsg);
                // This test passes if no exception was thrown
                yield this.recordTestResult('Language Command', true);
            }
            catch (error) {
                console.error('Error testing language command:', error);
                yield this.recordTestResult('Language Command', false, error instanceof Error ? error.message : String(error));
            }
        });
    }
    /**
     * Test the /users command (admin only)
     */
    testUserCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Create a mock message
                const mockMsg = {
                    chat: { id: this.chatId, type: 'private' },
                    from: { id: this.chatId, first_name: 'Test', is_bot: false },
                    message_id: 0,
                    date: Math.floor(Date.now() / 1000)
                };
                if ((0, utils_1.isAdmin)(this.chatId)) {
                    yield this.simulateCommand('/users', mockMsg);
                    yield this.recordTestResult('Users Command', true);
                }
                else {
                    yield this.recordTestResult('Users Command', true, 'Skipped - requires admin');
                }
            }
            catch (error) {
                console.error('Error testing users command:', error);
                yield this.recordTestResult('Users Command', false, error instanceof Error ? error.message : String(error));
            }
        });
    }
    /**
     * Test wallet connection flow
     */
    testConnectWalletFlow() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const connector = (0, connector_1.getConnector)(this.chatId);
                const isConnected = connector.connected;
                // Create a mock message
                const mockMsg = {
                    chat: { id: this.chatId, type: 'private' },
                    from: { id: this.chatId, first_name: 'Test', is_bot: false },
                    message_id: 0,
                    date: Math.floor(Date.now() / 1000)
                };
                // Test the workflow by calling connect command
                yield this.simulateCommand('/connect', mockMsg);
                // Note: we're not actually connecting a wallet here since that requires user interaction
                // We're just testing that the command executes without error
                yield this.recordTestResult('Connect Wallet Flow', true, isConnected ? 'Already connected' : 'Command executed successfully');
            }
            catch (error) {
                console.error('Error testing connect wallet flow:', error);
                yield this.recordTestResult('Connect Wallet Flow', false, error instanceof Error ? error.message : String(error));
            }
        });
    }
    /**
     * Test error handling mechanisms
     */
    testErrorHandling() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Inject a deliberately invalid message to test error handling
                const invalidMsg = {
                    chat: { id: this.chatId, type: 'private' },
                    from: { id: this.chatId, first_name: 'Test', is_bot: false },
                    message_id: 0,
                    date: Math.floor(Date.now() / 1000),
                    text: '/nonexistentcommand'
                };
                // This should trigger the error handler but not crash the bot
                yield this.simulateCommand('/nonexistentcommand', invalidMsg, false);
                // If we got here, error handling worked
                yield this.recordTestResult('Error Handling', true);
            }
            catch (error) {
                console.error('Error testing error handling:', error);
                yield this.recordTestResult('Error Handling', false, error instanceof Error ? error.message : String(error));
            }
        });
    }
    /**
     * Test the /tutorial command
     */
    testTutorialCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Create a mock message
                const mockMsg = {
                    chat: { id: this.chatId, type: 'private' },
                    from: { id: this.chatId, first_name: 'Test', is_bot: false },
                    message_id: 0,
                    date: Math.floor(Date.now() / 1000)
                };
                // Use a private utility to simulate sending a command
                yield this.simulateCommand('/tutorial', mockMsg);
                // This test passes if no exception was thrown
                yield this.recordTestResult('Tutorial Command', true);
            }
            catch (error) {
                console.error('Error testing tutorial command:', error);
                yield this.recordTestResult('Tutorial Command', false, error instanceof Error ? error.message : String(error));
            }
        });
    }
    /**
     * Utility method to simulate a command being sent to the bot
     * This avoids having to actually send messages to Telegram during testing
     */
    simulateCommand(command, mockMsg, expectReply = true) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Log the test attempt
                console.log(`Testing command: ${command}`);
                // Generate the appropriate command handler name, handling hyphens and underscores
                // First, clean the command name by removing leading slash and converting hyphens to underscores
                const cleanCommandName = command.substring(1).replace(/-/g, '_');
                // Convert to camelCase format expected for handler functions
                const formattedName = cleanCommandName.split('_')
                    .map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
                    .join('');
                // Create the handler function name
                const handlerName = `handle${formattedName.charAt(0).toUpperCase() + formattedName.slice(1)}Command`;
                console.log(`Looking for handler function: ${handlerName}`);
                // Try importing from commands-handlers first
                try {
                    const commandHandlers = yield Promise.resolve().then(() => __importStar(require('../commands-handlers')));
                    const handler = commandHandlers[handlerName];
                    if (typeof handler === 'function') {
                        yield handler(mockMsg);
                        return;
                    }
                }
                catch (importError) {
                    console.log(`Handler not found in commands-handlers, trying individual files`);
                }
                // If not found, try importing from individual module files
                try {
                    // Handle special cases for commands in their own files
                    if (cleanCommandName === 'language') {
                        const { handleLanguageCommand } = yield Promise.resolve().then(() => __importStar(require('../language-handler')));
                        yield handleLanguageCommand(mockMsg);
                        return;
                    }
                    else if (cleanCommandName === 'tutorial') {
                        const { handleTutorialCommand } = yield Promise.resolve().then(() => __importStar(require('../tutorial')));
                        yield handleTutorialCommand(mockMsg);
                        return;
                    }
                    else if (cleanCommandName === 'info') {
                        const { handleInfoCommand } = yield Promise.resolve().then(() => __importStar(require('../info-command')));
                        yield handleInfoCommand(mockMsg);
                        return;
                    }
                    else if (cleanCommandName === 'pay_now') {
                        const { handlePayNowCommand } = yield Promise.resolve().then(() => __importStar(require('../pay-now-command')));
                        yield handlePayNowCommand(mockMsg);
                        return;
                    }
                    else if (cleanCommandName === 'withdraw') {
                        const { handleWithdrawCommand } = yield Promise.resolve().then(() => __importStar(require('../withdraw-command')));
                        yield handleWithdrawCommand(mockMsg);
                        return;
                    }
                    else if (cleanCommandName === 'analytics') {
                        const { handleAnalyticsCommand } = yield Promise.resolve().then(() => __importStar(require('../analytics-service')));
                        yield handleAnalyticsCommand(mockMsg);
                        return;
                    }
                }
                catch (moduleError) {
                    console.log(`Error importing from module file: ${moduleError}`);
                }
                if (!expectReply) {
                    // If we're testing a nonexistent command and don't expect a reply, this is fine
                    return;
                }
                throw new Error(`Command handler ${handlerName} not found`);
            }
            catch (error) {
                if (expectReply) {
                    throw error;
                }
                // If we don't expect a reply, swallow the error
            }
        });
    }
}
exports.TestRunner = TestRunner;
/**
 * Handle the /test command to run all tests
 * This is an admin-only command
 */
function handleTestCommand(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Ensure only admins can run tests
        if (!(0, utils_1.isAdmin)(chatId)) {
            yield bot_1.bot.sendMessage(chatId, 'u26d4 Only administrators can run tests.');
            return;
        }
        const testRunner = new TestRunner(chatId);
        yield testRunner.runAllTests();
    });
}
exports.handleTestCommand = handleTestCommand;
/**
 * Handle the /test_results command to view previous test results
 * This is an admin-only command
 */
function handleTestResultsCommand(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Ensure only admins can view test results
        if (!(0, utils_1.isAdmin)(chatId)) {
            yield bot_1.bot.sendMessage(chatId, 'u26d4 Only administrators can view test results.');
            return;
        }
        try {
            const results = yield (0, storage_1.getTestResults)(chatId);
            if (!results || results.length === 0) {
                yield bot_1.bot.sendMessage(chatId, '📊 No test results found. Run /test to execute the test suite.');
                return;
            }
            const total = results.length;
            const passed = results.filter(r => r.success).length;
            const failed = total - passed;
            // Using plain text formatting to avoid Telegram parsing errors
            let message = `📊 Test Results

`;
            message += `Total Tests: ${total}
`;
            message += `✅ Passed: ${passed}
`;
            message += `❌ Failed: ${failed}

`;
            message += `Last 10 Test Results:
`;
            const recentTests = results.slice(Math.max(0, results.length - 10));
            for (const result of recentTests) {
                const icon = result.success ? '✅' : '❌';
                const time = new Date(result.timestamp).toLocaleString();
                message += `${icon} ${result.testName}${result.error ? `: ${result.error}` : ''} - ${time}
`;
            }
            // Don't use parse_mode to avoid Telegram entity parsing errors
            yield bot_1.bot.sendMessage(chatId, message);
        }
        catch (error) {
            console.error('Error retrieving test results:', error);
            yield bot_1.bot.sendMessage(chatId, '❌ Error retrieving test results.');
        }
    });
}
exports.handleTestResultsCommand = handleTestResultsCommand;
//# sourceMappingURL=test-runner.js.map