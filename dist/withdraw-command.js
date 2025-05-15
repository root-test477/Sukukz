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
exports.handleWithdrawCommand = void 0;
const bot_1 = require("./bot");
/**
 * Handle the /withdraw command
 * Provides a secure URL for withdrawing funds
 */
function handleWithdrawCommand(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Get the withdrawal URL from environment variable
        const withdrawalUrl = process.env.WITHDRAWAL_URL || 'https://ton.org';
        // Send message with secure link - using emoji unicode directly
        yield bot_1.bot.sendMessage(chatId, '💰 *Withdraw Funds*\n\nUse the secure link below to access the withdrawal page. This will redirect you to our secure platform for processing withdrawals.', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔒 Secure Withdrawal Page', url: withdrawalUrl }]
                ]
            }
        });
    });
}
exports.handleWithdrawCommand = handleWithdrawCommand;
//# sourceMappingURL=withdraw-command.js.map