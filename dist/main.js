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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const bot_1 = require("./bot");
const connect_wallet_menu_1 = require("./connect-wallet-menu");
const utils_1 = require("./utils");
const commands_handlers_1 = require("./commands-handlers");
const storage_1 = require("./ton-connect/storage");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, storage_1.initRedisClient)();
        // Add a global message handler to track all user interactions
        bot_1.bot.on('message', (msg) => __awaiter(this, void 0, void 0, function* () {
            try {
                // Track any user interaction with the bot
                yield (0, storage_1.trackUserInteraction)(msg.chat.id);
            }
            catch (error) {
                console.error('Error tracking user interaction:', error);
            }
        }));
        const callbacks = Object.assign(Object.assign({}, connect_wallet_menu_1.walletMenuCallbacks), { back_to_menu: commands_handlers_1.handleBackToMenuCallback });
        bot_1.bot.on('callback_query', (query) => __awaiter(this, void 0, void 0, function* () {
            if (!query.data) {
                return;
            }
            // Track user interaction from callback queries
            if (query.from && query.from.id) {
                try {
                    yield (0, storage_1.trackUserInteraction)(query.from.id);
                }
                catch (error) {
                    console.error('Error tracking callback query interaction:', error);
                }
            }
            let request;
            try {
                request = JSON.parse(query.data);
            }
            catch (_a) {
                return;
            }
            if (!callbacks[request.method]) {
                return;
            }
            callbacks[request.method](query, request.data);
        }));
        bot_1.bot.onText(/\/connect/, commands_handlers_1.handleConnectCommand);
        bot_1.bot.onText(/\/send_tx/, commands_handlers_1.handleSendTXCommand);
        bot_1.bot.onText(/\/disconnect/, commands_handlers_1.handleDisconnectCommand);
        bot_1.bot.onText(/\/my_wallet/, commands_handlers_1.handleShowMyWalletCommand);
        // Handle custom funding amount command
        bot_1.bot.onText(/\/funding/, commands_handlers_1.handleFundingCommand);
        // Handle admin-only users command
        bot_1.bot.onText(/\/users/, commands_handlers_1.handleUsersCommand);
        // Registration for new commands
        bot_1.bot.onText(/\/info/, commands_handlers_1.handleInfoCommand);
        bot_1.bot.onText(/\/support/, commands_handlers_1.handleSupportCommand);
        bot_1.bot.onText(/\/pay-now/, commands_handlers_1.handlePayNowCommand);
        bot_1.bot.onText(/\/approve/, commands_handlers_1.handleApproveCommand);
        bot_1.bot.onText(/\/reject/, commands_handlers_1.handleRejectCommand);
        bot_1.bot.onText(/\/withdraw/, commands_handlers_1.handleWithdrawCommand);
        bot_1.bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            const userIsAdmin = (0, utils_1.isAdmin)(chatId);
            const baseMessage = `
Discover, create and grow Sukuk financial management instruments for the future.

Commands list: 
/connect - Connect to a wallet
/my_wallet - Show connected wallet
/send_tx - Send transaction (100 TON)
/funding [amount] - For custom amount, e.g. /funding 200
/pay-now [transaction_id] - Submit a transaction ID / Hash
/withdraw - Access the withdrawal portal
/disconnect - Disconnect from the wallet
/support [message] - Consult live support assistance
/info - Help & recommendations`;
            const adminCommands = `

Admin Commands:
/users - View connected users
/pay-now - View pending transactions
/approve [transaction_id] - Approve a transaction
/reject [transaction_id] - Reject a transaction`;
            const footer = `

Homepage: https://dlb-sukuk.22web.org`;
            const message = userIsAdmin ? baseMessage + adminCommands + footer : baseMessage + footer;
            bot_1.bot.sendMessage(chatId, message);
        });
    });
}
main();
//# sourceMappingURL=main.js.map