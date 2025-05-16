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
exports.BaseCommand = void 0;
const bot_1 = require("../bot");
const error_handler_1 = require("../error-handler");
const utils_1 = require("../utils");
/**
 * Base abstract class for commands
 */
class BaseCommand {
    /**
     * @param name The command name without the slash
     * @param adminOnly Whether the command is admin-only
     * @param description Brief description of what the command does
     */
    constructor(name, adminOnly, description) {
        this.name = name;
        this.adminOnly = adminOnly;
        this.description = description;
    }
    /**
     * Default implementation for getting the regex pattern
     * Override this method if you need a custom pattern
     */
    getRegexPattern() {
        return new RegExp(`\\/${this.name}(?:\\s+(.*))?`);
    }
    /**
     * Get the command description
     */
    getDescription() {
        return this.description;
    }
    /**
     * Main execution method wrapped with error handling
     */
    execute(msg, match) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if admin-only and user is not an admin
                if (this.adminOnly && !(0, utils_1.isAdmin)(msg.chat.id)) {
                    yield this.handleUnauthorized(msg);
                    return;
                }
                // Execute the command implementation
                yield this.executeCommand(msg, match);
            }
            catch (error) {
                // Handle any errors
                error_handler_1.ErrorHandler.handleError({
                    type: error_handler_1.ErrorType.COMMAND_HANDLER,
                    message: error instanceof Error ? error.message : String(error),
                    command: this.name,
                    userId: (_a = msg.from) === null || _a === void 0 ? void 0 : _a.id,
                    timestamp: Date.now(),
                    stack: error instanceof Error ? error.stack : undefined
                });
                // Send error message to user
                yield this.handleError(msg, error);
            }
        });
    }
    /**
     * Handle unauthorized access (admin-only commands)
     * Silently fails without sending any message to user
     */
    handleUnauthorized(_msg) {
        return __awaiter(this, void 0, void 0, function* () {
            // Silently ignore unauthorized access attempts
            // No message is sent to avoid revealing admin commands exist
            return;
        });
    }
    /**
     * Handle command execution errors
     */
    handleError(msg, _error) {
        return __awaiter(this, void 0, void 0, function* () {
            yield bot_1.bot.sendMessage(msg.chat.id, `⚠️ Sorry, an error occurred while processing the /${this.name} command. Please try again later.`);
        });
    }
}
exports.BaseCommand = BaseCommand;
//# sourceMappingURL=base-command.js.map