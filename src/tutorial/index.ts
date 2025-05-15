import TelegramBot from 'node-telegram-bot-api';
import { bot } from '../bot';
import { getTranslation, SupportedLanguage } from '../localization';
import { getUserLanguage } from '../ton-connect/storage';

// Use the actual storage implementation for user language

/**
 * Tutorial Steps Interface 
 */
export interface TutorialStep {
  id: string;
  message: string;
  options?: TelegramBot.InlineKeyboardButton[][];
  nextStep?: string;
  isCompleted?: (msg: TelegramBot.Message | TelegramBot.CallbackQuery) => boolean;
}

/**
 * User Progress Interface
 */
export interface TutorialProgress {
  userId: number;
  currentStep: string;
  completedSteps: string[];
  startTime: number;
  lastActivity: number;
}

/**
 * Manages interactive tutorials for users
 */
export class Tutorial {
  private static readonly TUTORIAL_CALLBACK_PREFIX = 'tutorial_';
  private static readonly WALLET_TUTORIAL = 'wallet';
  private static readonly TRANSACTION_TUTORIAL = 'transaction';
  private static readonly GENERAL_TUTORIAL = 'general';
  
  private static userProgress: Map<number, TutorialProgress> = new Map();
  
  /**
   * Start a tutorial for a user
   */
  public static async startTutorial(chatId: number): Promise<void> {
    const language = await getUserLanguage(chatId) as SupportedLanguage;
    
    // Always start with the wallet tutorial for a streamlined experience
    const progress: TutorialProgress = {
      userId: chatId,
      currentStep: 'wallet_step1', // Always start with wallet tutorial
      completedSteps: [],
      startTime: Date.now(),
      lastActivity: Date.now()
    };
    
    this.userProgress.set(chatId, progress);
    
    // Send welcome message
    await bot.sendMessage(
      chatId,
      'Welcome to the setup tutorial! This will guide you through connecting your wallet and making transactions.',
      { parse_mode: 'Markdown' }
    );
    
    // Show first step
    await this.showCurrentStep(chatId);
  }
  
  /**
   * Handle tutorial callback queries
   */
  public static async handleTutorialCallback(query: TelegramBot.CallbackQuery): Promise<void> {
    if (!query.data || !query.data.startsWith(this.TUTORIAL_CALLBACK_PREFIX) || !query.message) {
      return;
    }
    
    const chatId = query.message.chat.id;
    const progress = this.userProgress.get(chatId);
    
    if (!progress) {
      // Tutorial not started or expired
      await bot.answerCallbackQuery(query.id, { text: 'Tutorial session expired. Please start again.' });
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
        // Check if current step requires wallet connection before proceeding
        if (progress.currentStep === 'wallet_step2') {
          // Import the connector to check if wallet is connected
          const { getConnector } = await import('../ton-connect/connector');
          const connector = getConnector(chatId);
          
          // If wallet is not connected, remind user to connect first
          if (!connector.connected) {
            await bot.answerCallbackQuery(query.id, {
              text: 'Please connect your wallet with /connect before proceeding',
              show_alert: true
            });
            
            // Send a message reminding the user to connect their wallet
            await bot.sendMessage(
              chatId,
              '*Important:* Please use /connect to connect your wallet before continuing with the tutorial.\n\nOnce your wallet is connected, click the Next button again.',
              { parse_mode: 'Markdown' }
            );
            return;
          }
        }
        
        // Move to next step
        progress.currentStep = currentStepDef.nextStep;
        progress.lastActivity = Date.now();
        
        await bot.answerCallbackQuery(query.id, {
          text: 'Step completed!'
        });
        
        // Show the next step
        await this.showCurrentStep(chatId);
      } else {
        // Tutorial completed
        const language = await getUserLanguage(chatId) as SupportedLanguage;
        await bot.sendMessage(
          chatId,
          getTranslation('tutorial_completed', language),
          { parse_mode: 'Markdown' }
        );
        
        // Clear progress
        this.userProgress.delete(chatId);
      }
    } else if (action === 'exit') {
      // Exit tutorial
      await bot.answerCallbackQuery(query.id, { text: 'Tutorial exited.' });
      this.userProgress.delete(chatId);
    }
  }
  
  /**
   * Show the current tutorial step to the user
   */
  private static async showCurrentStep(chatId: number): Promise<void> {
    const progress = this.userProgress.get(chatId);
    if (!progress) return;
    
    const stepDef = this.getTutorialStep(progress.currentStep);
    if (!stepDef) {
      await bot.sendMessage(chatId, 'Sorry, there was an error loading the tutorial step.');
      return;
    }
    
    const language = await getUserLanguage(chatId) as SupportedLanguage;
    
    // Default options if none provided
    let options = stepDef.options || [
      [{ text: 'Next', callback_data: `${this.TUTORIAL_CALLBACK_PREFIX}next_${progress.currentStep}` }],
      [{ text: 'Exit Tutorial', callback_data: `${this.TUTORIAL_CALLBACK_PREFIX}exit` }]
    ];
    
    await bot.sendMessage(chatId, stepDef.message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: options
      }
    });
  }
  
  /**
   * Get tutorial step definition
   */
  private static getTutorialStep(stepId: string): TutorialStep | null {
    // Mapping of all tutorial steps
    const steps: Record<string, TutorialStep> = {
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
        message: '*Viewing Wallet Info*\n\nAfter connecting, use /my_wallet to view your:\n\n- Wallet address\n- Balance (if available)\n- Connected wallet name',
        nextStep: 'wallet_step4'
      },
      'wallet_step4': {
        id: 'wallet_step4',
        message: '*Great job!*\n\nNow let\'s learn how to send transactions using the bot.',
        nextStep: 'transaction_step1'
      },
      
      // Transaction Tutorial
      'transaction_step1': {
        id: 'transaction_step1',
        message: '*Sending Transactions*\n\nNow that you know how to connect your wallet and view its details, let\'s learn how to send transactions.',
        nextStep: 'transaction_step2'
      },
      'transaction_step2': {
        id: 'transaction_step2',
        message: '*Using /send_tx Command*\n\nTo send a transaction, use the /send_tx command. This will initiate the transaction process.',
        nextStep: 'transaction_step3'
      },
      'transaction_step3': {
        id: 'transaction_step3',
        message: '*Confirming in Your Wallet*\n\nAfter using /send_tx:\n\n1. A confirmation request will appear in your wallet\n2. Review the transaction details carefully\n3. Approve or reject the transaction directly in your wallet app',
        nextStep: 'transaction_step4'
      },
      'transaction_step4': {
        id: 'transaction_step4',
        message: '*Transaction Status Updates*\n\nThe bot will keep you informed about your transaction:\n\n- When the transaction is submitted to the network\n- If there are any errors during processing\n- When the transaction is confirmed on the blockchain',
        nextStep: 'transaction_step5'
      },
      'transaction_step5': {
        id: 'transaction_step5',
        message: '*Congratulations!*\n\nYou\'ve completed the setup tutorial! You now know how to:\n\n1. Connect your wallet with /connect\n2. View your wallet details with /my_wallet\n3. Send transactions with /send_tx\n\nThese are the essential features that will help you get started with the bot.',
      }
    };
    
    return steps[stepId] || null;
  }
}

/**
 * Handle /tutorial command
 */
export async function handleTutorialCommand(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const language = await getUserLanguage(chatId) as SupportedLanguage;
  
  // Show tutorial options
  await bot.sendMessage(chatId, 'Choose a tutorial:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🤖 General Bot Tutorial', callback_data: 'tutorial_type_general' }],
        [{ text: '👛 Wallet Tutorial', callback_data: 'tutorial_type_wallet' }],
        [{ text: '💸 Transaction Tutorial', callback_data: 'tutorial_type_transaction' }]
      ]
    }
  });
}

/**
 * Handle tutorial type selection
 */
export async function handleTutorialTypeCallback(query: TelegramBot.CallbackQuery): Promise<void> {
  if (!query.data || !query.message) return;
  
  const chatId = query.message.chat.id;
  
  await bot.answerCallbackQuery(query.id);
  await Tutorial.startTutorial(chatId);
}
