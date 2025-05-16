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
const connector_1 = require("../ton-connect/connector");
const error_handler_1 = require("../error-handler");
/**
 * Command to handle withdrawals
 */
class WithdrawCommand extends base_command_1.BaseCommand {
    constructor() {
        super('withdraw', 'Initiate a withdrawal from your account');
    }
    execute(msg, _args) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            try {
                // Check if user has a connected wallet
                const connectedWallet = yield (0, connector_1.getConnectedWallet)(chatId);
                if (!connectedWallet) {
                    yield bot_1.bot.sendMessage(chatId, 'You need to connect a wallet before you can withdraw. Use /connect to connect your wallet.');
                    return;
                }
                // Get withdrawal URL from environment variable
                const withdrawalUrl = process.env.WITHDRAWAL_URL || 'https://example.com/withdraw';
                // Send withdrawal instructions with button
                yield bot_1.bot.sendMessage(chatId, '💰 *Withdrawal Process* 💰\n\n' +
                    'Click the button below to access the secure withdrawal form.\n\n' +
                    'Make sure to use the same wallet address that you have connected with this bot.', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔐 Secure Withdrawal Form', url: withdrawalUrl }]
                        ]
                    }
                });
            }
            catch (error) {
                if (error instanceof Error) {
                    yield error_handler_1.ErrorHandler.handleError(error, error_handler_1.ErrorType.COMMAND_HANDLER, {
                        commandName: 'withdraw',
                        userId: chatId,
                        message: msg.text || ''
                    });
                }
                yield bot_1.bot.sendMessage(chatId, '❌ Error processing withdrawal request. Please try again later.');
            }
        });
    }
}
exports.WithdrawCommand = WithdrawCommand;
//# sourceMappingURL=withdraw-command.js.map