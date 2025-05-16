"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandRegistry = void 0;
const bot_1 = require("../bot");
/**
 * Registry for all bot commands
 * Centralizes command registration and execution
 */
class CommandRegistry {
    /**
     * Get the singleton instance of CommandRegistry
     */
    static getInstance() {
        if (!CommandRegistry.instance) {
            CommandRegistry.instance = new CommandRegistry();
        }
        return CommandRegistry.instance;
    }
    // Private constructor to enforce singleton pattern
    constructor() {
        this.commands = new Map();
        this.commandCallbacks = new Map();
    }
    /**
     * Register a command with the registry
     */
    register(command) {
        // Don't register duplicate commands
        if (this.commands.has(command.name)) {
            console.warn(`Command '${command.name}' is already registered.`);
            return;
        }
        this.commands.set(command.name, command);
        // Store the handler that includes error handling
        if ('handler' in command) {
            this.commandCallbacks.set(command.name, command.handler);
        }
        else {
            // Fallback if the command doesn't have a handler method
            this.commandCallbacks.set(command.name, (msg, match) => __awaiter(this, void 0, void 0, function* () {
                const args = match && match[1] ? match[1].split(' ').filter(arg => arg.length > 0) : [];
                yield command.execute(msg, args);
            }));
        }
    }
    /**
     * Get a command by name
     */
    getCommand(name) {
        return this.commands.get(name);
    }
    /**
     * Get all registered commands
     */
    getAllCommands() {
        return Array.from(this.commands.values());
    }
    /**
     * Register all commands with the Telegram bot
     */
    registerWithBot() {
        for (const [name, command] of this.commands.entries()) {
            const callback = this.commandCallbacks.get(name);
            if (callback) {
                bot_1.bot.onText(new RegExp(`^\\/${name}(?:\\s+(.+))?$`), callback);
                console.log(`Registered command: /${name}`);
            }
        }
    }
    /**
     * Set up commands list in Telegram
     */
    setupCommandsList() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const commandsList = Array.from(this.commands.values())
                    .map(cmd => ({
                    command: cmd.name,
                    description: cmd.description
                }));
                yield bot_1.bot.setMyCommands(commandsList);
                console.log('Command list updated in Telegram');
            }
            catch (error) {
                console.error('Failed to set commands list:', error);
            }
        });
    }
}
exports.CommandRegistry = CommandRegistry;
//# sourceMappingURL=command-registry.js.map