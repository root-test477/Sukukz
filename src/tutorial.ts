import TelegramBot from 'node-telegram-bot-api';
import { bot } from './bot';
import { client } from './ton-connect/storage';
import { safeSendMessage } from './error-boundary';
import { getConnector } from './ton-connect/connector';

// Tutorial steps enum
export enum TutorialStep {
  WELCOME = 0,
  CONNECT_WALLET = 1,
  CHECK_WALLET = 2,
  SEND_TRANSACTION = 3,
  COMPLETED = 4
}

// Tutorial user data interface
export interface TutorialUserData {
  chatId: number;
  currentStep: TutorialStep;
  started: number;     // timestamp when tutorial was started
  lastActivity: number; // timestamp of last tutorial interaction
  completed: boolean;  // whether tutorial is completed
  skipped: boolean;    // whether tutorial was skipped
}

/**
 * Tutorial state management
 */
export class TutorialManager {
  private static readonly REDIS_TUTORIAL_KEY = 'tutorial_progress';
  private static readonly DEBUG = process.env.DEBUG_MODE === 'true';

  /**
   * Get tutorial progress for a user
   * @param chatId User's chat ID
   * @returns Tutorial progress data or null if not found
   */
  static async getTutorialProgress(chatId: number): Promise<TutorialUserData | null> {
    try {
      const data = await client.hGet(this.REDIS_TUTORIAL_KEY, chatId.toString());
      if (!data) return null;
      
      return JSON.parse(data) as TutorialUserData;
    } catch (error) {
      console.error('Error getting tutorial progress:', error);
      return null;
    }
  }

  /**
   * Save tutorial progress for a user
   * @param data Tutorial progress data
   */
  static async saveTutorialProgress(data: TutorialUserData): Promise<void> {
    try {
      await client.hSet(this.REDIS_TUTORIAL_KEY, data.chatId.toString(), JSON.stringify(data));
      
      if (this.DEBUG) {
        console.log(`[TUTORIAL] Saved progress for user ${data.chatId}: Step ${data.currentStep}`);
      }
    } catch (error) {
      console.error('Error saving tutorial progress:', error);
    }
  }

  /**
   * Start or resume the tutorial for a user
   * @param chatId User's chat ID
   * @returns Current tutorial step
   */
  static async startOrResumeTutorial(chatId: number): Promise<TutorialStep> {
    const existingProgress = await this.getTutorialProgress(chatId);
    
    if (existingProgress) {
      // Resume tutorial if already started
      existingProgress.lastActivity = Date.now();
      existingProgress.skipped = false; // Unmark as skipped if resuming
      await this.saveTutorialProgress(existingProgress);
      return existingProgress.currentStep;
    } else {
      // Start new tutorial
      const newProgress: TutorialUserData = {
        chatId,
        currentStep: TutorialStep.WELCOME,
        started: Date.now(),
        lastActivity: Date.now(),
        completed: false,
        skipped: false
      };
      await this.saveTutorialProgress(newProgress);
      return TutorialStep.WELCOME;
    }
  }

  /**
   * Advance to the next tutorial step
   * @param chatId User's chat ID
   * @returns New tutorial step or null if error
   */
  static async advanceToNextStep(chatId: number): Promise<TutorialStep | null> {
    const progress = await this.getTutorialProgress(chatId);
    if (!progress) return null;
    
    // Advance to next step if not completed
    if (progress.currentStep < TutorialStep.COMPLETED) {
      progress.currentStep++;
      progress.lastActivity = Date.now();
      
      // Mark as completed if reached final step
      if (progress.currentStep === TutorialStep.COMPLETED) {
        progress.completed = true;
      }
      
      await this.saveTutorialProgress(progress);
      return progress.currentStep;
    }
    
    return progress.currentStep;
  }

  /**
   * Skip the tutorial
   * @param chatId User's chat ID
   */
  static async skipTutorial(chatId: number): Promise<void> {
    const progress = await this.getTutorialProgress(chatId);
    
    if (progress) {
      progress.skipped = true;
      progress.lastActivity = Date.now();
      await this.saveTutorialProgress(progress);
    } else {
      // Create a new skipped tutorial entry
      const newProgress: TutorialUserData = {
        chatId,
        currentStep: TutorialStep.WELCOME,
        started: Date.now(),
        lastActivity: Date.now(),
        completed: false,
        skipped: true
      };
      await this.saveTutorialProgress(newProgress);
    }
  }

  /**
   * Check if the user is eligible for tutorial suggestion
   * (new users who haven't completed, skipped, or started the tutorial)
   * @param chatId User's chat ID
   */
  static async shouldSuggestTutorial(chatId: number): Promise<boolean> {
    const progress = await this.getTutorialProgress(chatId);
    
    // Suggest if no existing progress, or not completed and not skipped
    return !progress || (!progress.completed && !progress.skipped);
  }

  /**
   * Check if tutorial step is completed
   * @param chatId User's chat ID
   * @param step The step to check
   */
  static async checkStepCompleted(chatId: number, step: TutorialStep): Promise<boolean> {
    const progress = await this.getTutorialProgress(chatId);
    if (!progress) return false;
    
    return progress.currentStep > step;
  }
}

/**
 * Handle the /tutorial command
 * @param msg Telegram message object
 */
export async function handleTutorialCommand(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  
  try {
    // Start or resume the tutorial
    const currentStep = await TutorialManager.startOrResumeTutorial(chatId);
    await sendTutorialStep(chatId, currentStep);
  } catch (error) {
    console.error('Error handling tutorial command:', error);
    await safeSendMessage(chatId, '❌ Sorry, there was an error starting the tutorial. Please try again later.');
  }
}

/**
 * Handle the /skip command
 * @param msg Telegram message object
 */
export async function handleSkipCommand(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  
  try {
    await TutorialManager.skipTutorial(chatId);
    await safeSendMessage(
      chatId, 
      '✅ Tutorial skipped. You can resume it anytime by typing /tutorial.\n\nUse /connect to connect your wallet when you\'re ready.'
    );
  } catch (error) {
    console.error('Error handling skip command:', error);
    await safeSendMessage(chatId, '❌ Sorry, there was an error skipping the tutorial. Please try again later.');
  }
}

/**
 * Check if a step is completed and possibly advance tutorial
 * @param chatId User's chat ID
 * @param step The step that was completed
 */
export async function checkAndAdvanceTutorial(chatId: number, step: TutorialStep): Promise<void> {
  try {
    // Get the user's current progress
    const progress = await TutorialManager.getTutorialProgress(chatId);
    if (!progress || progress.skipped || progress.completed) return;
    
    // If this is the current step they're on, advance to the next
    if (progress.currentStep === step) {
      const nextStep = await TutorialManager.advanceToNextStep(chatId);
      if (nextStep !== null) {
        await sendTutorialStep(chatId, nextStep);
      }
    }
  } catch (error) {
    console.error('Error advancing tutorial:', error);
  }
}

/**
 * Auto-suggest tutorial to new users
 * @param chatId User's chat ID
 */
export async function autoSuggestTutorial(chatId: number): Promise<void> {
  try {
    const shouldSuggest = await TutorialManager.shouldSuggestTutorial(chatId);
    if (shouldSuggest) {
      await safeSendMessage(
        chatId,
        '🎓 Would you like to take a quick tutorial to learn how to use this bot?\n\nType /tutorial to start or /skip to dismiss.',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🎓 Start Tutorial', callback_data: JSON.stringify({ method: 'start_tutorial', data: '' }) },
                { text: '⏭️ Skip for Now', callback_data: JSON.stringify({ method: 'skip_tutorial', data: '' }) }
              ]
            ]
          }
        }
      );
    }
  } catch (error) {
    console.error('Error suggesting tutorial:', error);
  }
}

/**
 * Handle tutorial callbacks
 * @param query Callback query
 */
export async function handleTutorialCallback(query: TelegramBot.CallbackQuery, _data: string): Promise<void> {
  if (!query.message) return;
  
  const chatId = query.message.chat.id;
  
  try {
    if (query.data === 'start_tutorial') {
      // Start the tutorial
      const currentStep = await TutorialManager.startOrResumeTutorial(chatId);
      await bot.deleteMessage(chatId, query.message.message_id);
      await sendTutorialStep(chatId, currentStep);
    } else if (query.data === 'skip_tutorial') {
      // Skip the tutorial
      await TutorialManager.skipTutorial(chatId);
      await bot.editMessageText(
        '✅ Tutorial skipped. You can resume it anytime by typing /tutorial.',
        {
          chat_id: chatId,
          message_id: query.message.message_id
        }
      );
    } else if (query.data === 'tutorial_next') {
      // Advance to next step manually
      const nextStep = await TutorialManager.advanceToNextStep(chatId);
      if (nextStep !== null) {
        await bot.deleteMessage(chatId, query.message.message_id);
        await sendTutorialStep(chatId, nextStep);
      }
    }
  } catch (error) {
    console.error('Error handling tutorial callback:', error);
    await safeSendMessage(chatId, '❌ Sorry, there was an error with the tutorial. Please try typing /tutorial to restart.');
  }
}

/**
 * Send tutorial step message based on current step
 * @param chatId User's chat ID
 * @param step Current tutorial step
 */
async function sendTutorialStep(chatId: number, step: TutorialStep): Promise<void> {
  switch (step) {
    case TutorialStep.WELCOME:
      await safeSendMessage(
        chatId,
        '👋 *Welcome to the Interactive Tutorial!*\n\n' +
        'This guide will walk you through the main features of our bot:\n' +
        '1️⃣ Connecting your wallet\n' +
        '2️⃣ Checking wallet connection\n' +
        '3️⃣ Sending transactions\n\n' +
        'You can exit this tutorial anytime by typing /skip.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Start Tutorial', callback_data: JSON.stringify({ method: 'tutorial_next', data: '' }) }]
            ]
          }
        }
      );
      break;
      
    case TutorialStep.CONNECT_WALLET:
      const connector = getConnector(chatId);
      const isAlreadyConnected = connector.connected;
      
      let message = '🔗 *Step 1: Connect Your TON Wallet*\n\n';
      
      if (isAlreadyConnected) {
        message += '✅ Great! You already have a wallet connected.\n\n';
        await safeSendMessage(
          chatId,
          message,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Continue to Next Step', callback_data: JSON.stringify({ method: 'tutorial_next', data: '' }) }]
              ]
            }
          }
        );
      } else {
        message += 'To connect your wallet, follow these steps:\n\n' +
          '1. Type /connect or click the button below\n' +
          '2. Scan the QR code with your TON wallet app or click on your wallet name\n' +
          '3. Approve the connection in your wallet app\n\n' +
          'After connecting your wallet, return here and click "Continue" to proceed to the next step.';
        
        await safeSendMessage(
          chatId,
          message,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔗 Connect Wallet', callback_data: JSON.stringify({ method: 'connect_wallet', data: '' }) }],
                [{ text: 'I\'ve Connected My Wallet', callback_data: JSON.stringify({ method: 'tutorial_next', data: '' }) }]
              ]
            }
          }
        );
      }
      break;
      
    case TutorialStep.CHECK_WALLET:
      await safeSendMessage(
        chatId,
        '🔍 *Step 2: Check Your Wallet Connection*\n\n' +
        'Now let\'s verify your wallet connection and view your wallet details.\n\n' +
        'To check your wallet:\n' +
        '1. Type /my_wallet or click the button below\n' +
        '2. The bot will display your connected wallet address and balance\n\n' +
        'This command is useful to confirm your wallet is properly connected.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '👁️ Check My Wallet', callback_data: JSON.stringify({ method: 'show_wallet', data: '' }) }],
              [{ text: 'Continue to Next Step', callback_data: JSON.stringify({ method: 'tutorial_next', data: '' }) }]
            ]
          }
        }
      );
      break;
      
    case TutorialStep.SEND_TRANSACTION:
      await safeSendMessage(
        chatId,
        '💸 *Step 3: Send a Transaction*\n\n' +
        'Now you know how to connect and check your wallet, let\'s learn how to send transactions.\n\n' +
        'To send a transaction:\n' +
        '1. Type /send_tx or click the button below\n' +
        '2. Review the transaction details\n' +
        '3. Approve the transaction in your wallet\n\n' +
        '*Note:* You can also use /funding [amount] to specify a custom amount to send.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💸 Send Transaction', callback_data: JSON.stringify({ method: 'send_transaction', data: '' }) }],
              [{ text: 'Complete Tutorial', callback_data: JSON.stringify({ method: 'tutorial_next', data: '' }) }]
            ]
          }
        }
      );
      break;
      
    case TutorialStep.COMPLETED:
      await safeSendMessage(
        chatId,
        '🎉 *Congratulations! You\'ve Completed the Tutorial*\n\n' +
        'You\'ve learned how to:\n' +
        '✅ Connect your TON wallet\n' +
        '✅ Check your wallet connection\n' +
        '✅ Send transactions\n\n' +
        'Additional commands you might find useful:\n' +
        '• /info - Get help and feature recommendations\n' +
        '• /support - Contact support with questions\n' +
        '• /pay_now - Submit a transaction ID for approval\n' +
        '• /withdraw - Access the withdrawal portal\n\n' +
        'Enjoy using the bot! If you need this tutorial again, just type /tutorial.',
        {
          parse_mode: 'Markdown'
        }
      );
      break;
  }
}
