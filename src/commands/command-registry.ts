import TelegramBot from 'node-telegram-bot-api';
import { bot } from '../bot';
import { Command } from './base-command';

/**
 * Registry for all bot commands
 * Centralizes command registration and execution
 */
export class CommandRegistry {
    private static instance: CommandRegistry;
    
    /**
     * Get the singleton instance of CommandRegistry
     */
    public static getInstance(): CommandRegistry {
        if (!CommandRegistry.instance) {
            CommandRegistry.instance = new CommandRegistry();
        }
        return CommandRegistry.instance;
    }
    
    // Private constructor to enforce singleton pattern
    private constructor() {}
    private commands: Map<string, Command> = new Map();
    private commandCallbacks: Map<string, (msg: TelegramBot.Message, match?: RegExpMatchArray | null) => Promise<void>> = new Map();
    
    /**
     * Register a command with the registry
     */
    register(command: Command): void {
        // Don't register duplicate commands
        if (this.commands.has(command.name)) {
            console.warn(`Command '${command.name}' is already registered.`);
            return;
        }
        
        this.commands.set(command.name, command);
        // Store the handler that includes error handling
        if ('handler' in command) {
            this.commandCallbacks.set(command.name, (command as any).handler);
        } else {
            // Fallback if the command doesn't have a handler method
            this.commandCallbacks.set(command.name, async (msg, match) => {
                const args = match && match[1] ? match[1].split(' ').filter(arg => arg.length > 0) : [];
                await command.execute(msg, args);
            });
        }
    }
    
    /**
     * Get a command by name
     */
    getCommand(name: string): Command | undefined {
        return this.commands.get(name);
    }
    
    /**
     * Get all registered commands
     */
    getAllCommands(): Command[] {
        return Array.from(this.commands.values());
    }
    
    /**
     * Register all commands with the Telegram bot
     */
    registerWithBot(): void {
        for (const [name, command] of this.commands.entries()) {
            const callback = this.commandCallbacks.get(name);
            if (callback) {
                bot.onText(new RegExp(`^\\/${name}(?:\\s+(.+))?$`), callback);
                console.log(`Registered command: /${name}`);
            }
        }
    }
    
    /**
     * Set up commands list in Telegram
     */
    async setupCommandsList(): Promise<void> {
        try {
            const commandsList = Array.from(this.commands.values())
                .map(cmd => ({
                    command: cmd.name,
                    description: cmd.description
                }));
            
            await bot.setMyCommands(commandsList);
            console.log('Command list updated in Telegram');
        } catch (error) {
            console.error('Failed to set commands list:', error);
        }
    }
}
