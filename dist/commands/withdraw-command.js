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
exports.WithdrawCommand = void 0;
const base_command_1 = require("./base-command");
const bot_1 = require("../bot");
const error_handler_1 = require("../error-handler");
/**
 * Command for accessing withdrawal functionality
 */
class WithdrawCommand extends base_command_1.BaseCommand {
    constructor() {
        super('withdraw', false, 'Access the withdrawal interface');
    }
    executeCommand(msg) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            const userId = (_a = msg.from) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                yield bot_1.bot.sendMessage(chatId, '❌ Error: Could not identify user.');
                return;
            }
            try {
                // Get withdrawal URL from environment variable
                const withdrawalUrl = process.env.WITHDRAWAL_URL;
                if (!withdrawalUrl) {
                    yield bot_1.bot.sendMessage(chatId, '❌ Withdrawal system is currently unavailable. Please try again later.');
                    return;
                }
                // Send button to user
                yield bot_1.bot.sendMessage(chatId, '🔹 *Withdrawal System*\n\n' +
                    'Click the button below to access our secure withdrawal interface.', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔒 Access Withdrawal', url: withdrawalUrl }],
                            [{ text: '🏠 Back to Menu', callback_data: 'back_to_menu' }]
                        ]
                    }
                });
            }
            catch (error) {
                error_handler_1.ErrorHandler.handleError({
                    type: error_handler_1.ErrorType.COMMAND_HANDLER,
                    message: `Error in withdraw command: ${(error === null || error === void 0 ? void 0 : error.message) || error}`,
                    command: 'withdraw',
                    userId,
                    timestamp: Date.now(),
                    stack: error === null || error === void 0 ? void 0 : error.stack
                });
                yield bot_1.bot.sendMessage(chatId, '❌ An error occurred while accessing the withdrawal system. Please try again later.');
            }
        });
    }
}
exports.WithdrawCommand = WithdrawCommand;
//# sourceMappingURL=withdraw-command.js.map