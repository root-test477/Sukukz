import TelegramBot from 'node-telegram-bot-api';
import { bot } from '../bot';
import { Command } from './base-command';
import { ErrorHandler, ErrorType } from '../error-handler';

/**
 * Registry for all bot commands
 */
export class CommandRegistry {
    private static instance: CommandRegistry;
    private commands: Map<string, Command> = new Map();
    
    /**
     * Get the singleton instance of the registry
     */
    public static getInstance(): CommandRegistry {
        if (!CommandRegistry.instance) {
            CommandRegistry.instance = new CommandRegistry();
        }
        return CommandRegistry.instance;
    }
    
    /**
     * Private constructor to enforce singleton pattern
     */
    private constructor() {}
    
    /**
     * Register a command with the bot
     * @param command Command to register
     */
    public registerCommand(command: Command): void {
        // Add to the command map
        this.commands.set(command.name, command);
        
        // Register the command with the bot
        bot.onText(command.getRegexPattern(), async (msg, match) => {
            try {
                await command.execute(msg, match);
            } catch (error) {
                // Handle any errors that weren't caught by the command's own error handling
                ErrorHandler.handleError({
                    type: ErrorType.COMMAND_HANDLER,
                    message: error instanceof Error ? error.message : String(error),
                    command: command.name,
                    userId: msg.from?.id,
                    timestamp: Date.now(),
                    stack: error instanceof Error ? error.stack : undefined
                });
            }
        });
    }
    
    /**
     * Register multiple commands at once
     * @param commands Array of commands to register
     */
    public registerCommands(commands: Command[]): void {
        for (const command of commands) {
            this.registerCommand(command);
        }
    }
    
    /**
     * Get a command by name
     * @param name Command name
     */
    public getCommand(name: string): Command | undefined {
        return this.commands.get(name);
    }
    
    /**
     * Get all registered commands
     */
    public getAllCommands(): Command[] {
        return Array.from(this.commands.values());
    }
    
    /**
     * Get all commands that match a specific filter
     * @param filter Function to filter commands
     */
    public getFilteredCommands(filter: (command: Command) => boolean): Command[] {
        return this.getAllCommands().filter(filter);
    }
    
    /**
     * Get all user commands (non-admin commands)
     */
    public getUserCommands(): Command[] {
        return this.getFilteredCommands(command => !command.adminOnly);
    }
    
    /**
     * Get all admin commands
     */
    public getAdminCommands(): Command[] {
        return this.getFilteredCommands(command => command.adminOnly);
    }
}
