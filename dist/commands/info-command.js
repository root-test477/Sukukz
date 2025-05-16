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
 * Command to display bot information and help
 */
class InfoCommand extends base_command_1.BaseCommand {
    constructor() {
        super('info', 'Display information about the bot and available commands');
    }
    execute(msg, _args) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            const helpText = `
🤖 *TON Connect Bot Help* 🤖


*Wallet Connection*

• Use /connect to connect your TON wallet

• We recommend @wallet for the best experience


*Transactions*

• Submit transactions using /pay-now

• Check approval status with /pending


*Withdrawals*

• Use /withdraw to request withdrawals


*Support*

• Need help? Use /support [message]

• An admin will respond shortly


*Available Commands*

/connect - Connect your TON wallet

/disconnect - Disconnect your wallet

/mywallet - View your wallet details

/pay-now - Submit a transaction

/pending - View pending transactions

/withdraw - Access withdrawal form

/support - Contact support

/tutorial - Start the interactive tutorial

/skip - Skip the tutorial

/info - Show this help message


If you're new, start with the /tutorial command to learn how to use this bot.`;
            yield bot_1.bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
        });
    }
}
exports.InfoCommand = InfoCommand;
//# sourceMappingURL=info-command.js.map