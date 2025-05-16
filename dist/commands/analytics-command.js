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
exports.AnalyticsCommand = void 0;
const base_command_1 = require("./base-command");
const bot_1 = require("../bot");
const storage_1 = require("../ton-connect/storage");
/**
 * Admin command for displaying usage analytics
 */
class AnalyticsCommand extends base_command_1.AdminCommand {
    constructor() {
        super('analytics', 'View bot usage statistics');
    }
    executeAdmin(msg, _args) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            // Show loading message
            const loadingMessage = yield bot_1.bot.sendMessage(chatId, 'Generating analytics report...');
            try {
                // Fetch analytics data
                const analytics = yield (0, storage_1.getAnalyticsSummary)();
                // Format analytics report
                const timestamp = new Date(analytics.timestamp).toLocaleString();
                let report = `\ud83d\udcca *Bot Analytics Dashboard* \ud83d\udcca\n`;
                report += `\n*Generated:* ${timestamp}\n\n`;
                // User statistics
                report += `\ud83d\udc65 *User Statistics*\n`;
                report += `\u2022 Total Users: ${analytics.totalUsers}\n`;
                report += `\u2022 Users with Connected Wallets: ${analytics.connectedUsers}\n`;
                report += `\u2022 Active Users (24h): ${analytics.activeUsers24h}\n\n`;
                // Transaction statistics
                report += `\ud83d\udcb8 *Transaction Statistics*\n`;
                report += `\u2022 Total Submissions: ${analytics.transactionStats.total}\n`;
                report += `\u2022 Pending: ${analytics.transactionStats.pending}\n`;
                report += `\u2022 Approved: ${analytics.transactionStats.approved}\n`;
                report += `\u2022 Rejected: ${analytics.transactionStats.rejected}\n\n`;
                // Calculate approval rate
                const processedTx = analytics.transactionStats.approved + analytics.transactionStats.rejected;
                let approvalRate = 0;
                if (processedTx > 0) {
                    approvalRate = Math.round((analytics.transactionStats.approved / processedTx) * 100);
                }
                report += `\u2022 Approval Rate: ${approvalRate}%\n\n`;
                // Wallet connection rate
                const connectionRate = Math.round((analytics.connectedUsers / analytics.totalUsers) * 100);
                report += `\u2022 Wallet Connection Rate: ${connectionRate}%\n\n`;
                // Delete loading message and send report
                yield bot_1.bot.deleteMessage(chatId, loadingMessage.message_id);
                yield bot_1.bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
            }
            catch (error) {
                // Update loading message with error
                yield bot_1.bot.editMessageText('Error generating analytics report. Please try again later.', { chat_id: chatId, message_id: loadingMessage.message_id });
                console.error('Analytics error:', error);
            }
        });
    }
}
exports.AnalyticsCommand = AnalyticsCommand;
//# sourceMappingURL=analytics-command.js.map