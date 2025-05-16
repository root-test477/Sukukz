import { BaseCommand } from './base-command';
import TelegramBot from 'node-telegram-bot-api';
import { bot } from '../bot';
import { ErrorHandler, ErrorType } from '../error-handler';

/**
 * Command for accessing withdrawal functionality
 */
export class WithdrawCommand extends BaseCommand {
  constructor() {
    super('withdraw', false, 'Access the withdrawal interface');
  }

  protected async executeCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    if (!userId) {
      await bot.sendMessage(chatId, '❌ Error: Could not identify user.');
      return;
    }

    try {
      // Get withdrawal URL from environment variable
      const withdrawalUrl = process.env.WITHDRAWAL_URL;

      if (!withdrawalUrl) {
        await bot.sendMessage(
          chatId,
          '❌ Withdrawal system is currently unavailable. Please try again later.'
        );
        return;
      }

      // Send button to user
      await bot.sendMessage(
        chatId,
        '🔹 *Withdrawal System*\n\n' +
        'Click the button below to access our secure withdrawal interface.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔒 Access Withdrawal', url: withdrawalUrl }],
              [{ text: '🏠 Back to Menu', callback_data: 'back_to_menu' }]
            ]
          }
        }
      );
    } catch (error: any) {
      ErrorHandler.handleError({
        type: ErrorType.COMMAND_HANDLER,
        message: `Error in withdraw command: ${error?.message || error}`,
        command: 'withdraw',
        userId,
        timestamp: Date.now(),
        stack: error?.stack
      });

      await bot.sendMessage(
        chatId,
        '❌ An error occurred while accessing the withdrawal system. Please try again later.'
      );
    }
  }
}
