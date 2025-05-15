import TelegramBot from 'node-telegram-bot-api';
import { bot } from './bot';
import { getTranslation, SupportedLanguage } from './localization';

/**
 * Handle the /withdraw command
 * Provides a secure URL for withdrawing funds
 */
export async function handleWithdrawCommand(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  
  // Get the withdrawal URL from environment variable
  const withdrawalUrl = process.env.WITHDRAWAL_URL || 'https://ton.org';
  
  // Send message with secure link - using emoji unicode directly
  await bot.sendMessage(
    chatId,
    '💰 *Withdraw Funds*\n\nUse the secure link below to access the withdrawal page. This will redirect you to our secure platform for processing withdrawals.',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔒 Secure Withdrawal Page', url: withdrawalUrl }]
        ]
      }
    }
  );
}
