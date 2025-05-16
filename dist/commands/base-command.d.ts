import TelegramBot from 'node-telegram-bot-api';
/**
 * Base command interface that all commands must implement
 */
export interface Command {
    name: string;
    description: string;
    execute(msg: TelegramBot.Message, args?: string[]): Promise<void>;
}
/**
 * Base class for all bot commands
 */
export declare abstract class BaseCommand implements Command {
    readonly name: string;
    readonly description: string;
    constructor(name: string, description: string);
    abstract execute(msg: TelegramBot.Message, args?: string[]): Promise<void>;
    /**
     * Create an error-handled version of this command's execute method
     */
    get handler(): (msg: TelegramBot.Message, match?: RegExpMatchArray | null) => Promise<void>;
}
/**
 * Admin-only command that checks for admin privileges before executing
 */
export declare abstract class AdminCommand extends BaseCommand {
    execute(msg: TelegramBot.Message, args?: string[]): Promise<void>;
    abstract executeAdmin(msg: TelegramBot.Message, args?: string[]): Promise<void>;
}
/**
 * Wallet-required command that checks for connected wallet before executing
 */
export declare abstract class WalletRequiredCommand extends BaseCommand {
    execute(msg: TelegramBot.Message, args?: string[]): Promise<void>;
    abstract executeWithWallet(msg: TelegramBot.Message, args?: string[]): Promise<void>;
}
