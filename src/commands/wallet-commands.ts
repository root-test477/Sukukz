import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand } from './base-command';
import { bot } from '../bot';
import { getConnectedWallet, disconnectWallet } from '../ton-connect/connector';
import { getWalletBalance } from '../ton-connect/wallets';
import { ErrorHandler, ErrorType } from '../error-handler';

/**
 * Base class for wallet-related commands
 */
export abstract class WalletCommand extends BaseCommand {}

/**
 * Command to connect a wallet
 */
export class ConnectCommand extends WalletCommand {
    constructor() {
        super('connect', 'Connect your TON wallet');
    }
    
    async execute(msg: TelegramBot.Message, _args?: string[]): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            // Check if user already has a connected wallet
            const connectedWallet = await getConnectedWallet(chatId);
            
            if (connectedWallet) {
                await bot.sendMessage(
                    chatId,
                    `You already have a connected wallet: ${connectedWallet.address}\n\nUse /disconnect if you want to connect a different wallet.`
                );
                return;
            }
            
            // Send connection instructions
            const qrCodeUrl = 'https://example.com/connect-qr'; // In a real implementation, generate a QR code
            await bot.sendPhoto(chatId, qrCodeUrl, {
                caption: 'Scan this QR code with your TON wallet to connect, or click the link below:',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Connect with @wallet', url: 'https://t.me/wallet' }]
                    ]
                }
            });
        } catch (error) {
            if (error instanceof Error) {
                await ErrorHandler.handleError(error, ErrorType.WALLET_CONNECTION, {
                    commandName: 'connect',
                    userId: chatId,
                    message: msg.text || ''
                });
            }
            
            await bot.sendMessage(
                chatId,
                '\u274c Error initiating wallet connection. Please try again later.'
            );
        }
    }
}

/**
 * Command to disconnect a wallet
 */
export class DisconnectCommand extends WalletCommand {
    constructor() {
        super('disconnect', 'Disconnect your TON wallet');
    }
    
    async execute(msg: TelegramBot.Message, _args?: string[]): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            // Check if user has a connected wallet
            const connectedWallet = await getConnectedWallet(chatId);
            
            if (!connectedWallet) {
                await bot.sendMessage(
                    chatId,
                    'You don\'t have a connected wallet. Use /connect to connect one.'
                );
                return;
            }
            
            // Disconnect the wallet
            await disconnectWallet(chatId);
            
            await bot.sendMessage(
                chatId,
                '\u2705 Your wallet has been disconnected. Use /connect to connect again whenever you\'re ready.'
            );
        } catch (error) {
            if (error instanceof Error) {
                await ErrorHandler.handleError(error, ErrorType.WALLET_CONNECTION, {
                    commandName: 'disconnect',
                    userId: chatId,
                    message: msg.text || ''
                });
            }
            
            await bot.sendMessage(
                chatId,
                '\u274c Error disconnecting wallet. Please try again later.'
            );
        }
    }
}

/**
 * Command to view wallet details
 */
export class MyWalletCommand extends WalletCommand {
    constructor() {
        super('mywallet', 'View your connected wallet details');
    }
    
    async execute(msg: TelegramBot.Message, _args?: string[]): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            // Check if user has a connected wallet
            const connectedWallet = await getConnectedWallet(chatId);
            
            if (!connectedWallet) {
                await bot.sendMessage(
                    chatId,
                    'You don\'t have a connected wallet. Use /connect to connect one.'
                );
                return;
            }
            
            // Get wallet balance
            const balance = await getWalletBalance(connectedWallet.address);
            
            // Format wallet info message
            const walletInfo = `\ud83d\udcb0 *Wallet Information* \ud83d\udcb0\n\n` +
                              `*Address:* \`${connectedWallet.address}\`\n\n` +
                              `*Balance:* ${balance}\n\n` +
                              `*Connection Date:* ${new Date(connectedWallet.connectedAt).toLocaleString()}\n\n` +
                              `Use /disconnect to disconnect this wallet.`;
            
            await bot.sendMessage(chatId, walletInfo, { parse_mode: 'Markdown' });
        } catch (error) {
            if (error instanceof Error) {
                await ErrorHandler.handleError(error, ErrorType.WALLET_CONNECTION, {
                    commandName: 'mywallet',
                    userId: chatId,
                    message: msg.text || ''
                });
            }
            
            await bot.sendMessage(
                chatId,
                '\u274c Error fetching wallet details. Please try again later.'
            );
        }
    }
}
