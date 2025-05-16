import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand } from './base-command';
/**
 * Base class for wallet-related commands
 */
export declare abstract class WalletCommand extends BaseCommand {
}
/**
 * Command to connect a wallet
 */
export declare class ConnectCommand extends WalletCommand {
    constructor();
    execute(msg: TelegramBot.Message, args?: string[]): Promise<void>;
}
/**
 * Command to disconnect a wallet
 */
export declare class DisconnectCommand extends WalletCommand {
    constructor();
    execute(msg: TelegramBot.Message, args?: string[]): Promise<void>;
}
/**
 * Command to view wallet details
 */
export declare class MyWalletCommand extends WalletCommand {
    constructor();
    execute(msg: TelegramBot.Message, args?: string[]): Promise<void>;
}
