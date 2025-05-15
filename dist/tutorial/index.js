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
exports.handleTutorialTypeCallback = exports.handleTutorialCommand = exports.Tutorial = void 0;
const bot_1 = require("../bot");
const localization_1 = require("../localization");
const storage_1 = require("../ton-connect/storage");
/**
 * Manages interactive tutorials for users
 */
class Tutorial {
    /**
     * Start a tutorial for a user
     */
    static startTutorial(chatId, tutorialType) {
        return __awaiter(this, void 0, void 0, function* () {
            const language = yield (0, storage_1.getUserLanguage)(chatId);
            // Create a new progress entry
            const progress = {
                userId: chatId,
                currentStep: `${tutorialType}_step1`,
                completedSteps: [],
                startTime: Date.now(),
                lastActivity: Date.now()
            };
            this.userProgress.set(chatId, progress);
            // Send welcome message
            yield bot_1.bot.sendMessage(chatId, (0, localization_1.getTranslation)('tutorial_welcome', language), { parse_mode: 'Markdown' });
            // Show first step
            yield this.showCurrentStep(chatId);
        });
    }
    /**
     * Handle tutorial callback queries
     */
    static handleTutorialCallback(query) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!query.data || !query.data.startsWith(this.TUTORIAL_CALLBACK_PREFIX) || !query.message) {
                return;
            }
            const chatId = query.message.chat.id;
            const progress = this.userProgress.get(chatId);
            if (!progress) {
                // Tutorial not started or expired
                yield bot_1.bot.answerCallbackQuery(query.id, { text: 'Tutorial session expired. Please start again.' });
                return;
            }
            // Extract step information from callback data
            const data = query.data.substring(this.TUTORIAL_CALLBACK_PREFIX.length);
            const [action, stepId] = data.split('_');
            if (action === 'next') {
                // Mark current step as completed
                if (!progress.completedSteps.includes(progress.currentStep)) {
                    progress.completedSteps.push(progress.currentStep);
                }
                // Find the current step definition
                const currentStepDef = this.getTutorialStep(progress.currentStep);
                if (currentStepDef && currentStepDef.nextStep) {
                    // Move to next step
                    progress.currentStep = currentStepDef.nextStep;
                    progress.lastActivity = Date.now();
                    const language = yield (0, storage_1.getUserLanguage)(chatId);
                    yield bot_1.bot.answerCallbackQuery(query.id, {
                        text: (0, localization_1.getTranslation)('tutorial_step_completed', language)
                    });
                    // Show the next step
                    yield this.showCurrentStep(chatId);
                }
                else {
                    // Tutorial completed
                    const language = yield (0, storage_1.getUserLanguage)(chatId);
                    yield bot_1.bot.sendMessage(chatId, (0, localization_1.getTranslation)('tutorial_completed', language), { parse_mode: 'Markdown' });
                    // Clear progress
                    this.userProgress.delete(chatId);
                }
            }
            else if (action === 'exit') {
                // Exit tutorial
                yield bot_1.bot.answerCallbackQuery(query.id, { text: 'Tutorial exited.' });
                this.userProgress.delete(chatId);
            }
        });
    }
    /**
     * Show the current tutorial step to the user
     */
    static showCurrentStep(chatId) {
        return __awaiter(this, void 0, void 0, function* () {
            const progress = this.userProgress.get(chatId);
            if (!progress)
                return;
            const stepDef = this.getTutorialStep(progress.currentStep);
            if (!stepDef) {
                yield bot_1.bot.sendMessage(chatId, 'Sorry, there was an error loading the tutorial step.');
                return;
            }
            const language = yield (0, storage_1.getUserLanguage)(chatId);
            // Default options if none provided
            let options = stepDef.options || [
                [{ text: 'Next', callback_data: `${this.TUTORIAL_CALLBACK_PREFIX}next_${progress.currentStep}` }],
                [{ text: 'Exit Tutorial', callback_data: `${this.TUTORIAL_CALLBACK_PREFIX}exit` }]
            ];
            yield bot_1.bot.sendMessage(chatId, stepDef.message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: options
                }
            });
        });
    }
    /**
     * Get tutorial step definition
     */
    static getTutorialStep(stepId) {
        // Mapping of all tutorial steps
        const steps = {
            // General Bot Tutorial
            'general_step1': {
                id: 'general_step1',
                message: '*Welcome to the General Bot Tutorial!*\n\nThis tutorial will guide you through the basic features of the bot. Let\'s start!',
                nextStep: 'general_step2'
            },
            'general_step2': {
                id: 'general_step2',
                message: '*Commands Overview*\n\nHere are the main commands:\n\n/connect - Connect your wallet\n/disconnect - Disconnect your wallet\n/wallet - Show wallet info\n/send - Send a transaction\n/support - Get help\n/language - Change language\n/info - Bot information',
                nextStep: 'general_step3'
            },
            'general_step3': {
                id: 'general_step3',
                message: '*Getting Help*\n\nIf you need assistance, use the /support command followed by your message.\n\nExample: /support I need help with connecting my wallet',
                nextStep: 'general_step4'
            },
            'general_step4': {
                id: 'general_step4',
                message: '*That\'s it!*\n\nYou\'ve completed the general tutorial. Feel free to explore other tutorials or start using the bot.',
                options: [
                    [{ text: 'Start Wallet Tutorial', callback_data: `${this.TUTORIAL_CALLBACK_PREFIX}next_general_wallet` }],
                    [{ text: 'Finish', callback_data: `${this.TUTORIAL_CALLBACK_PREFIX}exit` }]
                ]
            },
            'general_wallet': {
                id: 'general_wallet',
                message: 'Starting wallet tutorial...',
                nextStep: 'wallet_step1'
            },
            // Wallet Tutorial
            'wallet_step1': {
                id: 'wallet_step1',
                message: '*Wallet Tutorial*\n\nThis tutorial will show you how to connect and use your wallet.\n\nFirst, you\'ll need to use the /connect command to link your wallet.',
                nextStep: 'wallet_step2'
            },
            'wallet_step2': {
                id: 'wallet_step2',
                message: '*Connecting Your Wallet*\n\nWhen you use /connect, you\'ll see:\n\n1. A QR code to scan with your mobile wallet\n2. A button to open your wallet directly',
                nextStep: 'wallet_step3'
            },
            'wallet_step3': {
                id: 'wallet_step3',
                message: '*Viewing Wallet Info*\n\nAfter connecting, use /wallet to view your:\n\n- Wallet address\n- Balance (if available)\n- Connected wallet name',
                nextStep: 'wallet_step4'
            },
            'wallet_step4': {
                id: 'wallet_step4',
                message: '*Disconnecting*\n\nTo disconnect your wallet, simply use the /disconnect command.\n\nThis ends your current wallet session and you\'ll need to reconnect later.',
                nextStep: 'wallet_step5'
            },
            'wallet_step5': {
                id: 'wallet_step5',
                message: '*Great job!*\n\nYou\'ve completed the wallet tutorial. Would you like to learn about transactions next?',
                options: [
                    [{ text: 'Start Transaction Tutorial', callback_data: `${this.TUTORIAL_CALLBACK_PREFIX}next_wallet_transaction` }],
                    [{ text: 'Finish', callback_data: `${this.TUTORIAL_CALLBACK_PREFIX}exit` }]
                ]
            },
            'wallet_transaction': {
                id: 'wallet_transaction',
                message: 'Starting transaction tutorial...',
                nextStep: 'transaction_step1'
            },
            // Transaction Tutorial
            'transaction_step1': {
                id: 'transaction_step1',
                message: '*Transaction Tutorial*\n\nThis tutorial will show you how to send transactions using the bot.',
                nextStep: 'transaction_step2'
            },
            'transaction_step2': {
                id: 'transaction_step2',
                message: '*Sending a Transaction*\n\nTo send a transaction:\n\n1. Make sure your wallet is connected first\n2. Use the /send command',
                nextStep: 'transaction_step3'
            },
            'transaction_step3': {
                id: 'transaction_step3',
                message: '*Confirming Transactions*\n\nAfter using /send:\n\n1. A confirmation request will appear in your wallet\n2. Review the details carefully\n3. Approve or reject the transaction in your wallet',
                nextStep: 'transaction_step4'
            },
            'transaction_step4': {
                id: 'transaction_step4',
                message: '*Transaction Status*\n\nThe bot will notify you of the transaction status:\n\n- When the transaction is sent\n- If there are any errors\n- When the transaction is confirmed on the blockchain',
                nextStep: 'transaction_step5'
            },
            'transaction_step5': {
                id: 'transaction_step5',
                message: '*Congratulations!*\n\nYou\'ve completed all the tutorials. You now know how to use the bot\'s main features.',
            }
        };
        return steps[stepId] || null;
    }
}
exports.Tutorial = Tutorial;
Tutorial.TUTORIAL_CALLBACK_PREFIX = 'tutorial_';
Tutorial.WALLET_TUTORIAL = 'wallet';
Tutorial.TRANSACTION_TUTORIAL = 'transaction';
Tutorial.GENERAL_TUTORIAL = 'general';
Tutorial.userProgress = new Map();
/**
 * Handle /tutorial command
 */
function handleTutorialCommand(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const language = yield (0, storage_1.getUserLanguage)(chatId);
        // Show tutorial options
        yield bot_1.bot.sendMessage(chatId, 'Choose a tutorial:', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🤖 General Bot Tutorial', callback_data: 'tutorial_type_general' }],
                    [{ text: '👛 Wallet Tutorial', callback_data: 'tutorial_type_wallet' }],
                    [{ text: '💸 Transaction Tutorial', callback_data: 'tutorial_type_transaction' }]
                ]
            }
        });
    });
}
exports.handleTutorialCommand = handleTutorialCommand;
/**
 * Handle tutorial type selection
 */
function handleTutorialTypeCallback(query) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!query.data || !query.message)
            return;
        const chatId = query.message.chat.id;
        const type = query.data.replace('tutorial_type_', '');
        yield bot_1.bot.answerCallbackQuery(query.id);
        yield Tutorial.startTutorial(chatId, type);
    });
}
exports.handleTutorialTypeCallback = handleTutorialTypeCallback;
//# sourceMappingURL=index.js.map