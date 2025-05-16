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
exports.WalletRequiredCommand = exports.AdminCommand = exports.BaseCommand = void 0;
const bot_1 = require("../bot");
const error_handler_1 = require("../error-handler");
const utils_1 = require("../utils");
/**
 * Base class for all bot commands
 */
class BaseCommand {
    constructor(name, description) {
        this.name = name;
        this.description = description;
    }
    /**
     * Create an error-handled version of this command's execute method
     */
    get handler() {
        return (0, error_handler_1.withErrorHandling)((msg, match) => __awaiter(this, void 0, void 0, function* () {
            const args = match && match[1] ? match[1].split(' ').filter(arg => arg.length > 0) : [];
            yield this.execute(msg, args);
        }), this.name);
    }
}
exports.BaseCommand = BaseCommand;
/**
 * Admin-only command that checks for admin privileges before executing
 */
class AdminCommand extends BaseCommand {
    execute(msg, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            if (!(0, utils_1.isAdmin)(chatId)) {
                yield bot_1.bot.sendMessage(chatId, 'This command is for admins only.');
                return;
            }
            yield this.executeAdmin(msg, args);
        });
    }
}
exports.AdminCommand = AdminCommand;
/**
 * Wallet-required command that checks for connected wallet before executing
 */
class WalletRequiredCommand extends BaseCommand {
    execute(msg, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            // Check if user has connected wallet logic would go here
            // For now, we'll implement this in the actual commands
            yield this.executeWithWallet(msg, args);
        });
    }
}
exports.WalletRequiredCommand = WalletRequiredCommand;
//# sourceMappingURL=base-command.js.map