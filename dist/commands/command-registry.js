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
const error_handler_1 = require("../error-handler");
/**
 * Registry for all bot commands
 */
class CommandRegistry {
    /**
     * Get the singleton instance of the registry
     */
    static getInstance() {
        if (!CommandRegistry.instance) {
            CommandRegistry.instance = new CommandRegistry();
        }
        return CommandRegistry.instance;
    }
    /**
     * Private constructor to enforce singleton pattern
     */
    constructor() {
        this.commands = new Map();
    }
    /**
     * Register a command with the bot
     * @param command Command to register
     */
    registerCommand(command) {
        // Add to the command map
        this.commands.set(command.name, command);
        // Register the command with the bot
        bot_1.bot.onText(command.getRegexPattern(), (msg, match) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                yield command.execute(msg, match);
            }
            catch (error) {
                // Handle any errors that weren't caught by the command's own error handling
                error_handler_1.ErrorHandler.handleError({
                    type: error_handler_1.ErrorType.COMMAND_HANDLER,
                    message: error instanceof Error ? error.message : String(error),
                    command: command.name,
                    userId: (_a = msg.from) === null || _a === void 0 ? void 0 : _a.id,
                    timestamp: Date.now(),
                    stack: error instanceof Error ? error.stack : undefined
                });
            }
        }));
    }
    /**
     * Register multiple commands at once
     * @param commands Array of commands to register
     */
    registerCommands(commands) {
        for (const command of commands) {
            this.registerCommand(command);
        }
    }
    /**
     * Get a command by name
     * @param name Command name
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
     * Get all commands that match a specific filter
     * @param filter Function to filter commands
     */
    getFilteredCommands(filter) {
        return this.getAllCommands().filter(filter);
    }
    /**
     * Get all user commands (non-admin commands)
     */
    getUserCommands() {
        return this.getFilteredCommands(command => !command.adminOnly);
    }
    /**
     * Get all admin commands
     */
    getAdminCommands() {
        return this.getFilteredCommands(command => command.adminOnly);
    }
}
exports.CommandRegistry = CommandRegistry;
//# sourceMappingURL=command-registry.js.map