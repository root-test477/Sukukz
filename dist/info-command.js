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
exports.handleInfoCommand = void 0;
const bot_1 = require("./bot");
/**
 * Handle the /info command
 * Provides help and feature recommendations to users
 */
function handleInfoCommand(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Default to English until we fix the storage reference
        const language = 'en';
        const message = [
            '📙 *Bot Information and Help*\n',
            '*Wallet Connection*',
            '• Use /connect to link your TON wallet',
            '• We recommend using @wallet for the best experience',
            '• To disconnect, use /disconnect',
            '• Check your wallet info with /wallet\n',
            '*Support*',
            '• Need help? Use /support followed by your message',
            '• Example: /support How do I connect my wallet?',
            '• Our team will respond to your query as soon as possible\n',
            '*Transactions*',
            '• Submit transactions with /pay_now',
            '• Follow the prompts to complete your submission',
            '• Admins will review and approve/reject your transaction',
            '• You will be notified when your transaction status changes\n',
            '*Withdrawals*',
            '• Use /withdraw to access the withdrawal page',
            '• Follow the secure process on the provided URL\n',
            '*Language*',
            '• Change your preferred language with /language',
            '• Multiple languages are supported including English, Spanish, Russian and more\n',
            '*Tutorials*',
            '• New to the bot? Try /tutorial for interactive guides',
            '• Learn how to connect wallets, send transactions, and more\n',
            '*Complete Command List*',
            '• /connect - Connect your wallet',
            '• /disconnect - Disconnect your wallet',
            '• /wallet - Show your wallet information',
            '• /send - Send a transaction',
            '• /pay_now - Submit a transaction for approval',
            '• /withdraw - Access the withdrawal page',
            '• /support - Get help from our team',
            '• /language - Change your language',
            '• /tutorial - Start interactive tutorials',
            '• /info - Show this information'
        ].join('\n');
        yield bot_1.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });
}
exports.handleInfoCommand = handleInfoCommand;
//# sourceMappingURL=info-command.js.map