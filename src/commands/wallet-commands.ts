import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand } from './base-command';
import { ErrorHandler, ErrorType } from '../error-handler';
import { bot } from '../bot';
import { getConnector } from '../ton-connect/connector';
import { CHAIN, toUserFriendlyAddress } from '@tonconnect/sdk';
import { getWalletInfo, getWalletBalance } from '../ton-connect/wallets';
import { getWallets } from '../ton-connect/wallets';
import { saveConnectedUser, removeConnectedUser } from '../ton-connect/storage';
import QRCode from 'qrcode';
import { buildUniversalKeyboard } from '../utils';

/**
 * Base class for all wallet-related commands
 */
export abstract class WalletCommand extends BaseCommand {
    /**
     * Check if a wallet is connected, restore the connection
     * @param chatId Chat ID
     * @returns True if the wallet is connected, false otherwise
     */
    protected async safeRestoreConnection(chatId: number): Promise<boolean> {
        try {
            const connector = getConnector(chatId);
            await connector.restoreConnection();
            return connector.connected;
        } catch (error: any) {
            ErrorHandler.handleError({
                type: ErrorType.WALLET_CONNECTION,
                message: `Error restoring wallet connection: ${error?.message || String(error)}`,
                userId: chatId,
                timestamp: Date.now(),
                stack: error?.stack
            });
            return false;
        }
    }
}

/**
 * Connect wallet command
 */
export class ConnectCommand extends WalletCommand {
    constructor() {
        super(
            'connect',    // command name
            false,        // not admin-only
            'Connect to a TON wallet' // description
        );
    }
    
    /**
     * Implementation of connect command
     */
    protected async executeCommand(msg: TelegramBot.Message): Promise<void> {
        const chatId = msg.chat.id;
        let messageWasDeleted = false;
        
        // Cancel any existing connection requests for this chat
        // Note: This would be better handled with a connection manager
        try {
            const connector = getConnector(chatId);
            
            await connector.restoreConnection();
            if (connector.connected) {
                const connectedName =
                    (await getWalletInfo(connector.wallet!.device.appName))?.name ||
                    connector.wallet!.device.appName;
                await bot.sendMessage(
                    chatId,
                    `You have already connected ${connectedName} wallet\nYour address: ${toUserFriendlyAddress(
                        connector.wallet!.account.address,
                        connector.wallet!.account.chain === CHAIN.TESTNET
                    )}\n\nDisconnect wallet first to connect a new one`
                );
                return;
            }

            // Set up wallet connection
            const unsubscribe = connector.onStatusChange(async wallet => {
                if (wallet) {
                    await deleteMessage();

                    const walletName =
                        (await getWalletInfo(wallet.device.appName))?.name || wallet.device.appName;
                    
                    // Save the connected user to storage
                    await saveConnectedUser(chatId, wallet.account.address);
                    
                    await bot.sendMessage(chatId, `${walletName} wallet connected successfully`);
                    unsubscribe();
                }
            });

            const wallets = await getWallets();
            const link = connector.connect(wallets);
            const image = await QRCode.toBuffer(link);
            const keyboard = await buildUniversalKeyboard(link, wallets);

            const botMessage = await bot.sendPhoto(chatId, image, {
                reply_markup: {
                    inline_keyboard: [keyboard]
                }
            });

            const deleteMessage = async (): Promise<void> => {
                if (!messageWasDeleted) {
                    messageWasDeleted = true;
                    try {
                        await bot.deleteMessage(chatId, botMessage.message_id);
                    } catch (e: any) {
                        // Ignore errors deleting message (might be already deleted)
                        console.log(`Failed to delete message: ${e?.message || e}`);
                    }
                }
            };
            
        } catch (error: any) {
            ErrorHandler.handleError({
                type: ErrorType.WALLET_CONNECTION,
                message: `Error connecting wallet: ${error?.message || String(error)}`,
                command: this.name,
                userId: msg.from?.id,
                timestamp: Date.now(),
                stack: error?.stack
            });
            throw error; // Re-throw to let the base command error handler manage the user message
        }
    }
}

/**
 * Disconnect wallet command
 */
export class DisconnectCommand extends WalletCommand {
    constructor() {
        super(
            'disconnect', // command name
            false,         // not admin-only
            'Disconnect from connected wallet' // description
        );
    }
    
    /**
     * Implementation of disconnect command
     */
    protected async executeCommand(msg: TelegramBot.Message): Promise<void> {
        try {
            const chatId = msg.chat.id;
            const connector = getConnector(chatId);
            
            await connector.restoreConnection();
            
            if (connector.connected) {
                connector.disconnect();
                await removeConnectedUser(chatId);
                await bot.sendMessage(chatId, 'Wallet disconnected');
            } else {
                await bot.sendMessage(chatId, 'No wallet connected');
            }
        } catch (error: any) {
            ErrorHandler.handleError({
                type: ErrorType.WALLET_CONNECTION,
                message: `Error disconnecting wallet: ${error?.message || String(error)}`,
                command: this.name,
                userId: msg.from?.id,
                timestamp: Date.now(),
                stack: error?.stack
            });
            throw error; // Re-throw to let the base command error handler manage the user message
        }
    }
}

/**
 * Show wallet command
 */
export class MyWalletCommand extends WalletCommand {
    constructor() {
        super(
            'my_wallet',   // command name
            false,         // not admin-only
            'Show connected wallet information' // description
        );
    }
    
    /**
     * Implementation of my_wallet command
     */
    protected async executeCommand(msg: TelegramBot.Message): Promise<void> {
        try {
            const chatId = msg.chat.id;
            const connector = getConnector(chatId);
            
            const connected = await this.safeRestoreConnection(chatId);
            if (!connected) {
                await bot.sendMessage(chatId, 'No wallet connected. Use /connect to connect a wallet.');
                return;
            }
            
            const walletName = (await getWalletInfo(connector.wallet!.device.appName))?.name || connector.wallet!.device.appName;
            const address = toUserFriendlyAddress(
                connector.wallet!.account.address,
                connector.wallet!.account.chain === CHAIN.TESTNET
            );
            
            // Get wallet balance (from cache or mock data in our implementation)
            const balance = await getWalletBalance(connector.wallet!.account.address);
            const balanceDisplay = balance ? `${balance.balance} TON` : 'Not available';
            
            await bot.sendMessage(
                chatId,
                `*Wallet Information*\n\n` +
                `*Wallet:* ${walletName}\n` +
                `*Address:* \`${address}\`\n` +
                `*Balance:* ${balanceDisplay}\n\n` +
                `Use /disconnect to disconnect this wallet.`,
                { parse_mode: 'Markdown' }
            );
        } catch (error: any) {
            ErrorHandler.handleError({
                type: ErrorType.WALLET_CONNECTION,
                message: `Error showing wallet: ${error?.message || String(error)}`,
                command: this.name,
                userId: msg.from?.id,
                timestamp: Date.now(),
                stack: error?.stack
            });
            throw error; // Re-throw to let the base command error handler manage the user message
        }
    }
}
