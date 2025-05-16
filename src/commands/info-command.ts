import { BaseCommand } from './base-command';
import TelegramBot from 'node-telegram-bot-api';
import { bot } from '../bot';

/**
 * Command to provide help and feature recommendations to users
 */
export class InfoCommand extends BaseCommand {
  constructor() {
    super('info', false, 'Get help and feature recommendations');
  }

  protected async executeCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const message = `🔹 *Welcome to TON Connect Bot!* 🔹\n\n` +
      `Here's what you can do:\n\n` +
      `🔸 *Connect Your Wallet:*\n` +
      `Use /connect to link your @wallet to this bot\n\n` +
      `🔸 *View Wallet Info:*\n` +
      `Use /mywallet to see your connected wallet details\n\n` +
      `🔸 *Submit Transactions:*\n` +
      `Use /pay-now to submit transactions for approval\n\n` +
      `🔸 *Withdraw Funds:*\n` +
      `Use /withdraw to access the withdrawal interface\n\n` +
      `🔸 *Get Support:*\n` +
      `Use /support [message] to contact our team\n\n` +
      `🔸 *Available Commands:*\n` +
      `/start - Start or restart the bot\n` +
      `/connect - Connect your wallet\n` +
      `/disconnect - Disconnect your wallet\n` +
      `/mywallet - View your wallet details\n` +
      `/tutorial - Start the interactive tutorial\n` +
      `/skip - Skip the tutorial\n` +
      `/pay-now - Submit a transaction\n` +
      `/withdraw - Access the withdrawal interface\n` +
      `/support - Contact support team\n` +
      `/info - Show this help message\n\n` +
      `Need more help? Use /support to contact our team.`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }
}
