import TelegramBot from 'node-telegram-bot-api';
import { bot } from './bot';
import { getConnector } from './ton-connect/connector';
import { CHAIN, toUserFriendlyAddress } from '@tonconnect/sdk';
import { getWalletInfo } from './ton-connect/wallets';

// Define tutorial stages
export enum TutorialStage {
  WELCOME = 0,
  CONNECT_WALLET = 1,
  CHECK_WALLET = 2,
  SEND_TRANSACTION = 3,
  COMPLETED = 4
}

// Interface for tutorial progress tracking
export interface TutorialProgress {
  chatId: number;
  currentStage: TutorialStage;
  startTimestamp: number;
  lastUpdateTimestamp: number;
  skipped: boolean;
}

// In-memory tutorial progress (in production, use Redis)
const tutorialProgress = new Map<number, TutorialProgress>();

/**
 * Initialize or get tutorial progress for a user
 */
export function getUserTutorialProgress(chatId: number): TutorialProgress {
  if (!tutorialProgress.has(chatId)) {
    const now = Date.now();
    tutorialProgress.set(chatId, {
      chatId,
      currentStage: TutorialStage.WELCOME,
      startTimestamp: now,
      lastUpdateTimestamp: now,
      skipped: false
    });
  }
  
  return tutorialProgress.get(chatId)!;
}

/**
 * Update tutorial progress for a user
 */
export function updateTutorialProgress(
  chatId: number, 
  stage: TutorialStage
): TutorialProgress {
  const progress = getUserTutorialProgress(chatId);
  progress.currentStage = stage;
  progress.lastUpdateTimestamp = Date.now();
  return progress;
}

/**
 * Mark tutorial as skipped
 */
export function skipTutorial(chatId: number): void {
  const progress = getUserTutorialProgress(chatId);
  progress.skipped = true;
  progress.currentStage = TutorialStage.COMPLETED;
  progress.lastUpdateTimestamp = Date.now();
}

/**
 * Check if the tutorial is complete
 */
export function isTutorialComplete(chatId: number): boolean {
  const progress = getUserTutorialProgress(chatId);
  return progress.currentStage === TutorialStage.COMPLETED || progress.skipped;
}

/**
 * Get message for current tutorial stage
 */
function getTutorialStageMessage(stage: TutorialStage): string {
  switch (stage) {
    case TutorialStage.WELCOME:
      return `🎓 *Welcome to the Tutorial!*\n\nThis guide will walk you through the basic features of our bot.\n\nWe'll cover:\n• Connecting your TON wallet\n• Viewing your wallet details\n• Sending transactions\n\nLet's get started!`;
    
    case TutorialStage.CONNECT_WALLET:
      return `🔗 *Step 1: Connect Your Wallet*\n\nPlease use the /connect command to link your TON wallet to our bot.\n\nYou'll see a QR code you can scan with your TON wallet app, or you can select one of the available wallet options.`;
    
    case TutorialStage.CHECK_WALLET:
      return `👛 *Step 2: Check Your Wallet*\n\nNow that your wallet is connected, let's verify it's working correctly.\n\nPlease use the /my_wallet command to see your wallet address and other details.`;
    
    case TutorialStage.SEND_TRANSACTION:
      return `💸 *Step 3: Send a Transaction*\n\nNow let's try sending a transaction. You can use:\n\n• /send_tx - for a standard transaction\n• /funding [amount] - for a custom amount (e.g., /funding 200)\n\nNote: This is a real transaction, so only proceed if you want to send actual TON.`;
    
    case TutorialStage.COMPLETED:
      return `🎉 *Tutorial Completed!*\n\nCongratulations! You've successfully completed the tutorial.\n\nYou now know how to:\n• Connect your wallet\n• View your wallet details\n• Send transactions\n\nFeel free to explore other features like:\n• /pay_now - Submit transaction IDs\n• /withdraw - Access withdrawal portal\n• /support - Get help when needed\n• /info - View more information`;
    
    default:
      return "Unknown tutorial stage";
  }
}

/**
 * Get keyboard for current tutorial stage
 */
function getTutorialStageKeyboard(stage: TutorialStage): TelegramBot.InlineKeyboardButton[][] {
  const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
  
  // Add stage-specific buttons
  switch (stage) {
    case TutorialStage.WELCOME:
      keyboard.push([{
        text: '▶️ Start Tutorial',
        callback_data: JSON.stringify({ method: 'tutorial_next', data: '' })
      }]);
      break;
    
    case TutorialStage.CONNECT_WALLET:
    case TutorialStage.CHECK_WALLET:
    case TutorialStage.SEND_TRANSACTION:
      // No stage-specific buttons
      break;
    
    case TutorialStage.COMPLETED:
      // Add button for withdrawal example
      keyboard.push([{
        text: '💰 Try Withdrawal Portal',
        callback_data: JSON.stringify({ method: 'tutorial_withdraw', data: '' })
      }]);
      break;
  }
  
  // Add navigation buttons for all stages except COMPLETED
  if (stage !== TutorialStage.COMPLETED) {
    const navButtons: TelegramBot.InlineKeyboardButton[] = [];
    
    // Skip button for all stages
    if (process.env.SKIP_TUTORIAL_ALLOWED === 'true') {
      navButtons.push({
        text: '⏭️ Skip Tutorial',
        callback_data: JSON.stringify({ method: 'tutorial_skip', data: '' })
      });
    }
    
    // Next button for all stages except WELCOME (which has its own button)
    if (stage !== TutorialStage.WELCOME) {
      navButtons.push({
        text: '⏩ Next Step',
        callback_data: JSON.stringify({ method: 'tutorial_next', data: '' })
      });
    }
    
    if (navButtons.length > 0) {
      keyboard.push(navButtons);
    }
  }
  
  return keyboard;
}

/**
 * Send tutorial stage message
 */
export async function sendTutorialStage(chatId: number, stage: TutorialStage): Promise<void> {
  const message = getTutorialStageMessage(stage);
  const keyboard = getTutorialStageKeyboard(stage);
  
  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
  
  // Update progress to this stage
  updateTutorialProgress(chatId, stage);
}

/**
 * Move to the next tutorial stage
 */
export async function moveToNextTutorialStage(chatId: number): Promise<void> {
  const progress = getUserTutorialProgress(chatId);
  
  // If already completed, stay at completed
  if (progress.currentStage === TutorialStage.COMPLETED) {
    await sendTutorialStage(chatId, TutorialStage.COMPLETED);
    return;
  }
  
  // Move to next stage
  const nextStage = progress.currentStage + 1;
  await sendTutorialStage(chatId, nextStage);
}

/**
 * Check if user has completed a specific stage requirement
 */
export async function checkStageCompletion(chatId: number): Promise<boolean> {
  const progress = getUserTutorialProgress(chatId);
  const connector = getConnector(chatId);
  
  switch (progress.currentStage) {
    case TutorialStage.CONNECT_WALLET:
      try {
        await connector.restoreConnection();
        return connector.connected;
      } catch (error) {
        console.error('Error checking wallet connection:', error);
        return false;
      }
    
    case TutorialStage.CHECK_WALLET:
      // This stage is completed when they use the /my_wallet command
      // The command handler will call the advance function
      return false;
    
    case TutorialStage.SEND_TRANSACTION:
      // This stage is completed when they use the /send_tx or /funding command
      // The command handler will call the advance function
      return false;
    
    default:
      return false;
  }
}

/**
 * Handle /tutorial command
 */
export async function handleTutorialCommand(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const progress = getUserTutorialProgress(chatId);
  
  // If they previously skipped, show notification but let them restart
  if (progress.skipped) {
    progress.skipped = false;
  }
  
  // Start from the beginning
  await sendTutorialStage(chatId, TutorialStage.WELCOME);
}

/**
 * Handle /skip command
 */
export async function handleSkipCommand(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  skipTutorial(chatId);
  
  await bot.sendMessage(
    chatId,
    "Tutorial has been skipped. You can start it again anytime with the /tutorial command."
  );
}

/**
 * Handle tutorial_next callback
 */
export async function handleTutorialNextCallback(query: TelegramBot.CallbackQuery): Promise<void> {
  if (!query.message || !query.from) return;
  
  const chatId = query.from.id;
  await moveToNextTutorialStage(chatId);
  
  // Remove the inline keyboard from the previous message
  try {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      }
    );
  } catch (error) {
    console.error('Error removing inline keyboard:', error);
  }
}

/**
 * Handle tutorial_skip callback
 */
export async function handleTutorialSkipCallback(query: TelegramBot.CallbackQuery): Promise<void> {
  if (!query.message || !query.from) return;
  
  const chatId = query.from.id;
  skipTutorial(chatId);
  
  await bot.sendMessage(
    chatId,
    "Tutorial has been skipped. You can start it again anytime with the /tutorial command."
  );
  
  // Remove the inline keyboard from the previous message
  try {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      }
    );
  } catch (error) {
    console.error('Error removing inline keyboard:', error);
  }
}

/**
 * Handle tutorial_withdraw callback
 */
export async function handleTutorialWithdrawCallback(query: TelegramBot.CallbackQuery): Promise<void> {
  if (!query.message || !query.from) return;
  
  const chatId = query.from.id;
  const withdrawUrl = process.env.WITHDRAW_URL || 'https://dlb-sukuk.22web.org/withdraw';
  
  await bot.sendMessage(
    chatId,
    '💰 *Withdraw Your Interest* 💰\n\nClick the button below to securely withdraw your earned interest through our website.',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{
            text: '🔐 Secure Withdrawal Portal',
            url: withdrawUrl
          }]
        ]
      }
    }
  );
  
  // Remove the inline keyboard from the previous message
  try {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      }
    );
  } catch (error) {
    console.error('Error removing inline keyboard:', error);
  }
}

/**
 * Use this function in command handlers to automatically advance the tutorial
 * if the user completes a required step
 */
export async function advanceTutorialIfNeeded(
  chatId: number, 
  completedAction: 'connect' | 'check_wallet' | 'send_tx'
): Promise<void> {
  const progress = getUserTutorialProgress(chatId);
  
  // If tutorial is already completed or skipped, do nothing
  if (progress.currentStage === TutorialStage.COMPLETED || progress.skipped) {
    return;
  }
  
  let shouldAdvance = false;
  
  // Check if the action matches the current stage requirement
  switch (completedAction) {
    case 'connect':
      shouldAdvance = progress.currentStage === TutorialStage.CONNECT_WALLET;
      break;
    
    case 'check_wallet':
      shouldAdvance = progress.currentStage === TutorialStage.CHECK_WALLET;
      break;
    
    case 'send_tx':
      shouldAdvance = progress.currentStage === TutorialStage.SEND_TRANSACTION;
      break;
  }
  
  if (shouldAdvance) {
    // Wait a bit to avoid message collision
    setTimeout(async () => {
      await bot.sendMessage(
        chatId,
        "✅ Great! You've completed this step of the tutorial."
      );
      
      // Move to next stage
      await moveToNextTutorialStage(chatId);
    }, 1000);
  }
} 