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
exports.InfoCommand = void 0;
const base_command_1 = require("./base-command");
const bot_1 = require("../bot");
/**
 * Command to provide help and feature recommendations to users
 */
class InfoCommand extends base_command_1.BaseCommand {
    constructor() {
        super('info', false, 'Get help and feature recommendations');
    }
    executeCommand(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            const message = `🔹 *Welcome to TON Connect Bot!* 🔹\n\n` +
                `Here's what you can do:\n\n` +
                `🔸 *Connect Your Wallet:*\n` +
                `Use /connect to link your @wallet to this bot\n\n` +
                `🔸 *View Wallet Info:*\n` +
                `Use /mywallet to see your connected wallet details\n\n` +
                `🔸 *Submit Transactions:*\n` +
                `Use /pay-now to submit transactions for approval\n\n` +
                `🔸 *Withdraw Funds:*\n` +
                `Use /withdraw to access the withdrawal interface\n\n` +
                `🔸 *Get Support:*\n` +
                `Use /support [message] to contact our team\n\n` +
                `🔸 *Available Commands:*\n` +
                `/start - Start or restart the bot\n` +
                `/connect - Connect your wallet\n` +
                `/disconnect - Disconnect your wallet\n` +
                `/mywallet - View your wallet details\n` +
                `/tutorial - Start the interactive tutorial\n` +
                `/skip - Skip the tutorial\n` +
                `/pay-now - Submit a transaction\n` +
                `/withdraw - Access the withdrawal interface\n` +
                `/support - Contact support team\n` +
                `/info - Show this help message\n\n` +
                `Need more help? Use /support to contact our team.`;
            yield bot_1.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        });
    }
}
exports.InfoCommand = InfoCommand;
//# sourceMappingURL=info-command.js.map