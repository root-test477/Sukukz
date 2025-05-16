import { Command } from './base-command';
/**
 * Registry for all bot commands
 */
export declare class CommandRegistry {
    private static instance;
    private commands;
    /**
     * Get the singleton instance of the registry
     */
    static getInstance(): CommandRegistry;
    /**
     * Private constructor to enforce singleton pattern
     */
    private constructor();
    /**
     * Register a command with the bot
     * @param command Command to register
     */
    registerCommand(command: Command): void;
    /**
     * Register multiple commands at once
     * @param commands Array of commands to register
     */
    registerCommands(commands: Command[]): void;
    /**
     * Get a command by name
     * @param name Command name
     */
    getCommand(name: string): Command | undefined;
    /**
     * Get all registered commands
     */
    getAllCommands(): Command[];
    /**
     * Get all commands that match a specific filter
     * @param filter Function to filter commands
     */
    getFilteredCommands(filter: (command: Command) => boolean): Command[];
    /**
     * Get all user commands (non-admin commands)
     */
    getUserCommands(): Command[];
    /**
     * Get all admin commands
     */
    getAdminCommands(): Command[];
}
