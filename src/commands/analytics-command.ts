import TelegramBot from 'node-telegram-bot-api';
import { AdminCommand } from './base-command';
import { bot } from '../bot';
import { getAnalyticsSummary } from '../ton-connect/storage';

/**
 * Admin command for displaying usage analytics
 */
export class AnalyticsCommand extends AdminCommand {
    constructor() {
        super('analytics', 'View bot usage statistics');
    }
    
    async executeAdmin(msg: TelegramBot.Message, _args?: string[]): Promise<void> {
        const chatId = msg.chat.id;
        
        // Show loading message
        const loadingMessage = await bot.sendMessage(chatId, 'Generating analytics report...');
        
        try {
            // Fetch analytics data
            const analytics = await getAnalyticsSummary();
            
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
            await bot.deleteMessage(chatId, loadingMessage.message_id);
            await bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
            
        } catch (error) {
            // Update loading message with error
            await bot.editMessageText(
                'Error generating analytics report. Please try again later.',
                { chat_id: chatId, message_id: loadingMessage.message_id }
            );
            console.error('Analytics error:', error);
        }
    }
}
