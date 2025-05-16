import TelegramBot from 'node-telegram-bot-api';
import { bot } from '../bot';
import { withErrorHandling } from '../error-handler';
import { isAdmin } from '../utils';

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
export abstract class BaseCommand implements Command {
    constructor(
        public readonly name: string,
        public readonly description: string
    ) {}
    
    abstract execute(msg: TelegramBot.Message, args?: string[]): Promise<void>;
    
    /**
     * Create an error-handled version of this command's execute method
     */
    get handler(): (msg: TelegramBot.Message, match?: RegExpMatchArray | null) => Promise<void> {
        return withErrorHandling(
            async (msg: TelegramBot.Message, match?: RegExpMatchArray | null) => {
                const args = match && match[1] ? match[1].split(' ').filter(arg => arg.length > 0) : [];
                await this.execute(msg, args);
            },
            this.name
        );
    }
}

/**
 * Admin-only command that checks for admin privileges before executing
 */
export abstract class AdminCommand extends BaseCommand {
    async execute(msg: TelegramBot.Message, args?: string[]): Promise<void> {
        const chatId = msg.chat.id;
        
        if (!isAdmin(chatId)) {
            await bot.sendMessage(chatId, 'This command is for admins only.');
            return;
        }
        
        await this.executeAdmin(msg, args);
    }
    
    abstract executeAdmin(msg: TelegramBot.Message, args?: string[]): Promise<void>;
}

/**
 * Wallet-required command that checks for connected wallet before executing
 */
export abstract class WalletRequiredCommand extends BaseCommand {
    async execute(msg: TelegramBot.Message, args?: string[]): Promise<void> {
        const chatId = msg.chat.id;
        
        // Check if user has connected wallet logic would go here
        // For now, we'll implement this in the actual commands
        
        await this.executeWithWallet(msg, args);
    }
    
    abstract executeWithWallet(msg: TelegramBot.Message, args?: string[]): Promise<void>;
}
