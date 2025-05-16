import TelegramBot from 'node-telegram-bot-api';
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
export declare abstract class BaseCommand implements Command {
    readonly name: string;
    readonly adminOnly: boolean;
    private readonly description;
    /**
     * @param name The command name without the slash
     * @param adminOnly Whether the command is admin-only
     * @param description Brief description of what the command does
     */
    constructor(name: string, adminOnly: boolean, description: string);
    /**
     * Default implementation for getting the regex pattern
     * Override this method if you need a custom pattern
     */
    getRegexPattern(): RegExp;
    /**
     * Get the command description
     */
    getDescription(): string;
    /**
     * Main execution method wrapped with error handling
     */
    execute(msg: TelegramBot.Message, match?: RegExpExecArray | null): Promise<void>;
    /**
     * Command implementation
     * Must be implemented by subclasses
     */
    protected abstract executeCommand(msg: TelegramBot.Message, match?: RegExpExecArray | null): Promise<void>;
    /**
     * Handle unauthorized access (admin-only commands)
     * Silently fails without sending any message to user
     */
    protected handleUnauthorized(_msg: TelegramBot.Message): Promise<void>;
    /**
     * Handle command execution errors
     */
    protected handleError(msg: TelegramBot.Message, _error: unknown): Promise<void>;
}
