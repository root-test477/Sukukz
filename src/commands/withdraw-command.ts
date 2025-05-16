import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand } from './base-command';
import { bot } from '../bot';
import { getConnectedWallet } from '../ton-connect/connector';
import { ErrorHandler, ErrorType } from '../error-handler';

/**
 * Command to handle withdrawals
 */
export class WithdrawCommand extends BaseCommand {
    constructor() {
        super('withdraw', 'Initiate a withdrawal from your account');
    }
    
    async execute(msg: TelegramBot.Message, _args?: string[]): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            // Check if user has a connected wallet
            const connectedWallet = await getConnectedWallet(chatId);
            
            if (!connectedWallet) {
                await bot.sendMessage(
                    chatId,
                    'You need to connect a wallet before you can withdraw. Use /connect to connect your wallet.'
                );
                return;
            }
            
            // Get withdrawal URL from environment variable
            const withdrawalUrl = process.env.WITHDRAWAL_URL || 'https://example.com/withdraw';
            
            // Send withdrawal instructions with button
            await bot.sendMessage(
                chatId,
                '💰 *Withdrawal Process* 💰\n\n' +
                'Click the button below to access the secure withdrawal form.\n\n' +
                'Make sure to use the same wallet address that you have connected with this bot.',
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔐 Secure Withdrawal Form', url: withdrawalUrl }]
                        ]
                    }
                }
            );
        } catch (error) {
            if (error instanceof Error) {
                await ErrorHandler.handleError(error, ErrorType.COMMAND_HANDLER, {
                    commandName: 'withdraw',
                    userId: chatId,
                    message: msg.text || ''
                });
            }
            
            await bot.sendMessage(
                chatId,
                '❌ Error processing withdrawal request. Please try again later.'
            );
        }
    }
}
