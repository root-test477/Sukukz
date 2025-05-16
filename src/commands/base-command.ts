import TelegramBot from 'node-telegram-bot-api';
import { bot } from '../bot';
import { ErrorHandler, ErrorType } from '../error-handler';
import { isAdmin } from '../utils';

/**
 * Base command interface that all commands must implement
 */
export interface Command {
    /**
     * The command name without the slash
     */
    readonly name: string;
    
    /**
     * Determine if the command is admin-only
     */
    readonly adminOnly: boolean;
    
    /**
     * Execute the command
     * @param msg The Telegram message that triggered the command
     * @param match The regex match results (if any)
     */
    execute(msg: TelegramBot.Message, match?: RegExpExecArray | null): Promise<void>;
    
    /**
     * Get the regex pattern to match this command
     */
    getRegexPattern(): RegExp;
    
    /**
     * Returns the command description for help text
     */
    getDescription(): string;
}

/**
 * Base abstract class for commands
 */
export abstract class BaseCommand implements Command {
    /**
     * @param name The command name without the slash
     * @param adminOnly Whether the command is admin-only
     * @param description Brief description of what the command does
     */
    constructor(
        public readonly name: string,
        public readonly adminOnly: boolean,
        private readonly description: string
    ) {}
    
    /**
     * Default implementation for getting the regex pattern
     * Override this method if you need a custom pattern
     */
    getRegexPattern(): RegExp {
        return new RegExp(`\\/${this.name}(?:\\s+(.*))?`);
    }
    
    /**
     * Get the command description
     */
    getDescription(): string {
        return this.description;
    }
    
    /**
     * Main execution method wrapped with error handling
     */
    async execute(msg: TelegramBot.Message, match?: RegExpExecArray | null): Promise<void> {
        try {
            // Check if admin-only and user is not an admin
            if (this.adminOnly && !isAdmin(msg.chat.id)) {
                await this.handleUnauthorized(msg);
                return;
            }
            
            // Execute the command implementation
            await this.executeCommand(msg, match);
        } catch (error) {
            // Handle any errors
            ErrorHandler.handleError({
                type: ErrorType.COMMAND_HANDLER,
                message: error instanceof Error ? error.message : String(error),
                command: this.name,
                userId: msg.from?.id,
                timestamp: Date.now(),
                stack: error instanceof Error ? error.stack : undefined
            });
            
            // Send error message to user
            await this.handleError(msg, error);
        }
    }
    
    /**
     * Command implementation
     * Must be implemented by subclasses
     */
    protected abstract executeCommand(msg: TelegramBot.Message, match?: RegExpExecArray | null): Promise<void>;
    
    /**
     * Handle unauthorized access (admin-only commands)
     * Silently fails without sending any message to user
     */
    protected async handleUnauthorized(_msg: TelegramBot.Message): Promise<void> {
        // Silently ignore unauthorized access attempts
        // No message is sent to avoid revealing admin commands exist
        return;
    }
    
    /**
     * Handle command execution errors
     */
    protected async handleError(msg: TelegramBot.Message, _error: unknown): Promise<void> {
        await bot.sendMessage(
            msg.chat.id,
            `⚠️ Sorry, an error occurred while processing the /${this.name} command. Please try again later.`
        );
    }
}
