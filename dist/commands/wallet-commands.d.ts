import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand } from './base-command';
/**
 * Base class for all wallet-related commands
 */
export declare abstract class WalletCommand extends BaseCommand {
    /**
     * Check if a wallet is connected, restore the connection
     * @param chatId Chat ID
     * @returns True if the wallet is connected, false otherwise
     */
    protected safeRestoreConnection(chatId: number): Promise<boolean>;
}
/**
 * Connect wallet command
 */
export declare class ConnectCommand extends WalletCommand {
    constructor();
    /**
     * Implementation of connect command
     */
    protected executeCommand(msg: TelegramBot.Message): Promise<void>;
}
/**
 * Disconnect wallet command
 */
export declare class DisconnectCommand extends WalletCommand {
    constructor();
    /**
     * Implementation of disconnect command
     */
    protected executeCommand(msg: TelegramBot.Message): Promise<void>;
}
/**
 * Show wallet command
 */
export declare class MyWalletCommand extends WalletCommand {
    constructor();
    /**
     * Implementation of my_wallet command
     */
    protected executeCommand(msg: TelegramBot.Message): Promise<void>;
}
