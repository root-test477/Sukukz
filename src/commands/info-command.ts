import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand } from './base-command';
import { bot } from '../bot';

/**
 * Command to display bot information and help
 */
export class InfoCommand extends BaseCommand {
    constructor() {
        super('info', 'Display information about the bot and available commands');
    }
    
    async execute(msg: TelegramBot.Message, _args?: string[]): Promise<void> {
        const chatId = msg.chat.id;
        
        const helpText = `
🤖 *TON Connect Bot Help* 🤖


*Wallet Connection*

• Use /connect to connect your TON wallet

• We recommend @wallet for the best experience


*Transactions*

• Submit transactions using /pay-now

• Check approval status with /pending


*Withdrawals*

• Use /withdraw to request withdrawals


*Support*

• Need help? Use /support [message]

• An admin will respond shortly


*Available Commands*

/connect - Connect your TON wallet

/disconnect - Disconnect your wallet

/mywallet - View your wallet details

/pay-now - Submit a transaction

/pending - View pending transactions

/withdraw - Access withdrawal form

/support - Contact support

/tutorial - Start the interactive tutorial

/skip - Skip the tutorial

/info - Show this help message


If you're new, start with the /tutorial command to learn how to use this bot.`;

        await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
    }
}
