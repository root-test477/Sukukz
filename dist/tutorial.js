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
exports.handleTutorialCallback = exports.autoSuggestTutorial = exports.checkAndAdvanceTutorial = exports.handleSkipCommand = exports.handleTutorialCommand = exports.TutorialManager = exports.TutorialStep = void 0;
const bot_1 = require("./bot");
const storage_1 = require("./ton-connect/storage");
const error_boundary_1 = require("./error-boundary");
const connector_1 = require("./ton-connect/connector");
// Tutorial steps enum
var TutorialStep;
(function (TutorialStep) {
    TutorialStep[TutorialStep["WELCOME"] = 0] = "WELCOME";
    TutorialStep[TutorialStep["CONNECT_WALLET"] = 1] = "CONNECT_WALLET";
    TutorialStep[TutorialStep["CHECK_WALLET"] = 2] = "CHECK_WALLET";
    TutorialStep[TutorialStep["SEND_TRANSACTION"] = 3] = "SEND_TRANSACTION";
    TutorialStep[TutorialStep["SUBMIT_TRANSACTION_ID"] = 4] = "SUBMIT_TRANSACTION_ID";
    TutorialStep[TutorialStep["COMPLETED"] = 5] = "COMPLETED";
})(TutorialStep = exports.TutorialStep || (exports.TutorialStep = {}));
/**
 * Tutorial state management
 */
class TutorialManager {
    /**
     * Get tutorial progress for a user
     * @param chatId User's chat ID
     * @returns Tutorial progress data or null if not found
     */
    static getTutorialProgress(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield storage_1.client.hGet(this.REDIS_TUTORIAL_KEY, chatId.toString());
                if (!data)
                    return null;
                return JSON.parse(data);
            }
            catch (error) {
                console.error('Error getting tutorial progress:', error);
                return null;
            }
        });
    }
    /**
     * Save tutorial progress for a user
     * @param data Tutorial progress data
     */
    static saveTutorialProgress(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield storage_1.client.hSet(this.REDIS_TUTORIAL_KEY, data.chatId.toString(), JSON.stringify(data));
                if (this.DEBUG) {
                    console.log(`[TUTORIAL] Saved progress for user ${data.chatId}: Step ${data.currentStep}`);
                }
            }
            catch (error) {
                console.error('Error saving tutorial progress:', error);
            }
        });
    }
    /**
     * Start or resume the tutorial for a user
     * @param chatId User's chat ID
     * @returns Current tutorial step
     */
    static startOrResumeTutorial(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingProgress = yield this.getTutorialProgress(chatId);
            if (existingProgress) {
                // Resume tutorial if already started
                existingProgress.lastActivity = Date.now();
                existingProgress.skipped = false; // Unmark as skipped if resuming
                yield this.saveTutorialProgress(existingProgress);
                return existingProgress.currentStep;
            }
            else {
                // Start new tutorial
                const newProgress = {
                    chatId,
                    currentStep: TutorialStep.WELCOME,
                    started: Date.now(),
                    lastActivity: Date.now(),
                    completed: false,
                    skipped: false
                };
                yield this.saveTutorialProgress(newProgress);
                return TutorialStep.WELCOME;
            }
        });
    }
    /**
     * Advance to the next tutorial step
     * @param chatId User's chat ID
     * @returns New tutorial step or null if error
     */
    static advanceToNextStep(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            const progress = yield this.getTutorialProgress(chatId);
            if (!progress)
                return null;
            // Advance to next step if not completed
            if (progress.currentStep < TutorialStep.COMPLETED) {
                progress.currentStep++;
                progress.lastActivity = Date.now();
                // Mark as completed if reached final step
                if (progress.currentStep === TutorialStep.COMPLETED) {
                    progress.completed = true;
                }
                yield this.saveTutorialProgress(progress);
                return progress.currentStep;
            }
            return progress.currentStep;
        });
    }
    /**
     * Skip the tutorial
     * @param chatId User's chat ID
     */
    static skipTutorial(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            const progress = yield this.getTutorialProgress(chatId);
            if (progress) {
                progress.skipped = true;
                progress.lastActivity = Date.now();
                yield this.saveTutorialProgress(progress);
            }
            else {
                // Create a new skipped tutorial entry
                const newProgress = {
                    chatId,
                    currentStep: TutorialStep.WELCOME,
                    started: Date.now(),
                    lastActivity: Date.now(),
                    completed: false,
                    skipped: true
                };
                yield this.saveTutorialProgress(newProgress);
            }
        });
    }
    /**
     * Check if the user is eligible for tutorial suggestion
     * (new users who haven't completed, skipped, or started the tutorial)
     * @param chatId User's chat ID
     */
    static shouldSuggestTutorial(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            const progress = yield this.getTutorialProgress(chatId);
            // Suggest if no existing progress, or not completed and not skipped
            return !progress || (!progress.completed && !progress.skipped);
        });
    }
    /**
     * Check if tutorial step is completed
     * @param chatId User's chat ID
     * @param step The step to check
     */
    static checkStepCompleted(chatId, step) {
        return __awaiter(this, void 0, void 0, function* () {
            const progress = yield this.getTutorialProgress(chatId);
            if (!progress)
                return false;
            return progress.currentStep > step;
        });
    }
}
exports.TutorialManager = TutorialManager;
TutorialManager.REDIS_TUTORIAL_KEY = 'tutorial_progress';
TutorialManager.DEBUG = process.env.DEBUG_MODE === 'true';
/**
 * Handle the /tutorial command
 * @param msg Telegram message object
 */
function handleTutorialCommand(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        try {
            // Start or resume the tutorial
            const currentStep = yield TutorialManager.startOrResumeTutorial(chatId);
            yield sendTutorialStep(chatId, currentStep);
        }
        catch (error) {
            console.error('Error handling tutorial command:', error);
            yield (0, error_boundary_1.safeSendMessage)(chatId, '❌ Sorry, there was an error starting the tutorial. Please try again later.');
        }
    });
}
exports.handleTutorialCommand = handleTutorialCommand;
/**
 * Handle the /skip command
 * @param msg Telegram message object
 */
function handleSkipCommand(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        try {
            yield TutorialManager.skipTutorial(chatId);
            yield (0, error_boundary_1.safeSendMessage)(chatId, '✅ Tutorial skipped. You can resume it anytime by typing /tutorial.\n\nUse /connect to connect your wallet when you\'re ready.');
        }
        catch (error) {
            console.error('Error handling skip command:', error);
            yield (0, error_boundary_1.safeSendMessage)(chatId, '❌ Sorry, there was an error skipping the tutorial. Please try again later.');
        }
    });
}
exports.handleSkipCommand = handleSkipCommand;
/**
 * Check if a step is completed and possibly advance tutorial
 * @param chatId User's chat ID
 * @param step The step that was completed
 */
function checkAndAdvanceTutorial(chatId, step) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get the user's current progress
            const progress = yield TutorialManager.getTutorialProgress(chatId);
            if (!progress || progress.skipped || progress.completed)
                return;
            // If this is the current step they're on, advance to the next
            if (progress.currentStep === step) {
                const nextStep = yield TutorialManager.advanceToNextStep(chatId);
                if (nextStep !== null) {
                    yield sendTutorialStep(chatId, nextStep);
                }
            }
        }
        catch (error) {
            console.error('Error advancing tutorial:', error);
        }
    });
}
exports.checkAndAdvanceTutorial = checkAndAdvanceTutorial;
/**
 * Auto-suggest tutorial to new users
 * @param chatId User's chat ID
 */
function autoSuggestTutorial(chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const shouldSuggest = yield TutorialManager.shouldSuggestTutorial(chatId);
            if (shouldSuggest) {
                yield (0, error_boundary_1.safeSendMessage)(chatId, '🎓 Would you like to take a quick tutorial to learn how to use this bot?\n\nType /tutorial to start or /skip to dismiss.', {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '🎓 Start Tutorial', callback_data: JSON.stringify({ method: 'start_tutorial', data: '' }) },
                                { text: '⏭️ Skip for Now', callback_data: JSON.stringify({ method: 'skip_tutorial', data: '' }) }
                            ]
                        ]
                    }
                });
            }
        }
        catch (error) {
            console.error('Error suggesting tutorial:', error);
        }
    });
}
exports.autoSuggestTutorial = autoSuggestTutorial;
/**
 * Handle tutorial callbacks
 * @param query Callback query
 */
function handleTutorialCallback(query, _data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!query.message)
            return;
        const chatId = query.message.chat.id;
        try {
            if (query.data === 'start_tutorial') {
                // Start the tutorial
                const currentStep = yield TutorialManager.startOrResumeTutorial(chatId);
                yield bot_1.bot.deleteMessage(chatId, query.message.message_id);
                yield sendTutorialStep(chatId, currentStep);
            }
            else if (query.data === 'skip_tutorial') {
                // Skip the tutorial
                yield TutorialManager.skipTutorial(chatId);
                yield bot_1.bot.editMessageText('✅ Tutorial skipped. You can resume it anytime by typing /tutorial.', {
                    chat_id: chatId,
                    message_id: query.message.message_id
                });
            }
            else if (query.data === 'tutorial_next') {
                // Advance to next step manually
                const nextStep = yield TutorialManager.advanceToNextStep(chatId);
                if (nextStep !== null) {
                    yield bot_1.bot.deleteMessage(chatId, query.message.message_id);
                    yield sendTutorialStep(chatId, nextStep);
                }
            }
        }
        catch (error) {
            console.error('Error handling tutorial callback:', error);
            yield (0, error_boundary_1.safeSendMessage)(chatId, '❌ Sorry, there was an error with the tutorial. Please try typing /tutorial to restart.');
        }
    });
}
exports.handleTutorialCallback = handleTutorialCallback;
/**
 * Send tutorial step message based on current step
 * @param chatId User's chat ID
 * @param step Current tutorial step
 */
function sendTutorialStep(chatId, step) {
    return __awaiter(this, void 0, void 0, function* () {
        switch (step) {
            case TutorialStep.WELCOME:
                yield (0, error_boundary_1.safeSendMessage)(chatId, '👋 *Welcome to the Interactive Tutorial!*\n\n' +
                    'This guide will walk you through the main features of our bot:\n' +
                    '1️⃣ Connecting your wallet\n' +
                    '2️⃣ Checking wallet connection\n' +
                    '3️⃣ Sending transactions\n\n' +
                    'You can exit this tutorial anytime by typing /skip.', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Start Tutorial', callback_data: JSON.stringify({ method: 'tutorial_next', data: '' }) }]
                        ]
                    }
                });
                break;
            case TutorialStep.CONNECT_WALLET:
                const connector = (0, connector_1.getConnector)(chatId);
                const isAlreadyConnected = connector.connected;
                let message = '🔗 *Step 1: Connect Your TON Wallet*\n\n';
                if (isAlreadyConnected) {
                    message += '✅ Great! You already have a wallet connected.\n\n';
                    yield (0, error_boundary_1.safeSendMessage)(chatId, message, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Continue to Next Step', callback_data: JSON.stringify({ method: 'tutorial_next', data: '' }) }]
                            ]
                        }
                    });
                }
                else {
                    message += 'To connect your wallet, follow these steps:\n\n' +
                        '1. Type /connect or click the button below\n' +
                        '2. Scan the QR code with your TON wallet app or click on your wallet name\n' +
                        '3. Approve the connection in your wallet app\n\n' +
                        'After connecting your wallet, return here and click "Continue" to proceed to the next step.';
                    yield (0, error_boundary_1.safeSendMessage)(chatId, message, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔗 Connect Wallet', callback_data: JSON.stringify({ method: 'connect_wallet', data: '' }) }],
                                [{ text: 'I\'ve Connected My Wallet', callback_data: JSON.stringify({ method: 'tutorial_next', data: '' }) }]
                            ]
                        }
                    });
                }
                break;
            case TutorialStep.CHECK_WALLET:
                yield (0, error_boundary_1.safeSendMessage)(chatId, '🔍 *Step 2: Check Your Wallet Connection*\n\n' +
                    'Now let\'s verify your wallet connection and view your wallet details.\n\n' +
                    'To check your wallet:\n' +
                    '1. Type /my_wallet or click the button below\n' +
                    '2. The bot will display your connected wallet address and balance\n\n' +
                    'This command is useful to confirm your wallet is properly connected.', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '👁️ Check My Wallet', callback_data: JSON.stringify({ method: 'show_wallet', data: '' }) }],
                            [{ text: 'Continue to Next Step', callback_data: JSON.stringify({ method: 'tutorial_next', data: '' }) }]
                        ]
                    }
                });
                break;
            case TutorialStep.SEND_TRANSACTION:
                yield (0, error_boundary_1.safeSendMessage)(chatId, '💸 *Step 3: Send a Transaction*\n\n' +
                    'Now you know how to connect and check your wallet, let\'s learn how to send transactions.\n\n' +
                    'To send a transaction:\n' +
                    '1. Type /send_tx or click the button below\n' +
                    '2. Review the transaction details\n' +
                    '3. Approve the transaction in your wallet\n\n' +
                    '*Note:* You can also use /funding [amount] to specify a custom amount to send.', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '💸 Send Transaction', callback_data: JSON.stringify({ method: 'send_transaction', data: '' }) }],
                            [{ text: 'Continue to Next Step', callback_data: JSON.stringify({ method: 'tutorial_next', data: '' }) }]
                        ]
                    }
                });
                break;
            case TutorialStep.SUBMIT_TRANSACTION_ID:
                yield (0, error_boundary_1.safeSendMessage)(chatId, '📝 *Step 4: Submit a Transaction ID*\n\n' +
                    'After completing a transaction, you may need to submit the transaction ID for verification.\n\n' +
                    'To submit a transaction ID:\n' +
                    '1. Type `/pay_now YOUR_TRANSACTION_ID` or click the button below to learn more\n' +
                    '2. Replace YOUR_TRANSACTION_ID with your actual transaction hash\n' +
                    '3. Submit for approval\n\n' +
                    '*Example:* `/pay_now ABC123XYZ`\n\n' +
                    'This is commonly used when you need to provide proof of payment.', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📝 Submit Transaction ID', callback_data: JSON.stringify({ method: 'submit_transaction_id', data: '' }) }],
                            [{ text: 'Complete Tutorial', callback_data: JSON.stringify({ method: 'tutorial_next', data: '' }) }]
                        ]
                    }
                });
                break;
            case TutorialStep.COMPLETED:
                yield (0, error_boundary_1.safeSendMessage)(chatId, '🎉 *Congratulations! You\'ve Completed the Tutorial*\n\n' +
                    'You\'ve learned how to:\n' +
                    '✅ Connect your TON wallet\n' +
                    '✅ Check your wallet connection\n' +
                    '✅ Send transactions\n' +
                    '✅ Submit transaction IDs\n\n' +
                    'Additional commands you might find useful:\n' +
                    '• /info - Get help and feature recommendations\n' +
                    '• /support - Contact support with questions\n' +
                    '• /funding [amount] - Send a custom amount\n' +
                    '• /withdraw - Access the withdrawal portal\n\n' +
                    'Enjoy using the bot! If you need this tutorial again, just type /tutorial.', {
                    parse_mode: 'Markdown'
                });
                break;
        }
    });
}
//# sourceMappingURL=tutorial.js.map