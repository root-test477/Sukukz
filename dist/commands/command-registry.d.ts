import { Command } from './base-command';
/**
 * Registry for all bot commands
 * Centralizes command registration and execution
 */
export declare class CommandRegistry {
    private static instance;
    /**
     * Get the singleton instance of CommandRegistry
     */
    static getInstance(): CommandRegistry;
    private constructor();
    private commands;
    private commandCallbacks;
    /**
     * Register a command with the registry
     */
    register(command: Command): void;
    /**
     * Get a command by name
     */
    getCommand(name: string): Command | undefined;
    /**
     * Get all registered commands
     */
    getAllCommands(): Command[];
    /**
     * Register all commands with the Telegram bot
     */
    registerWithBot(): void;
    /**
     * Set up commands list in Telegram
     */
    setupCommandsList(): Promise<void>;
}
