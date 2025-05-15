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
exports.handleAnalyticsCommand = exports.AnalyticsService = void 0;
const bot_1 = require("./bot");
const storage_1 = require("./ton-connect/storage");
const utils_1 = require("./utils");
/**
 * Service for collecting and displaying analytics data
 */
class AnalyticsService {
    /**
     * Track command usage
     */
    static trackCommand(command) {
        const cleanCommand = command.startsWith('/') ? command.substring(1) : command;
        if (!this.commandUsage[cleanCommand]) {
            this.commandUsage[cleanCommand] = 0;
        }
        this.commandUsage[cleanCommand]++;
    }
    /**
     * Collect current analytics data
     */
    static collectAnalytics(period = 'day') {
        return __awaiter(this, void 0, void 0, function* () {
            const now = Date.now();
            const allUsers = yield (0, storage_1.getAllTrackedUsers)();
            // Filter users by activity period
            let timeCutoff = 0;
            switch (period) {
                case 'day':
                    timeCutoff = now - 24 * 60 * 60 * 1000; // 24 hours
                    break;
                case 'week':
                    timeCutoff = now - 7 * 24 * 60 * 60 * 1000; // 7 days
                    break;
                case 'month':
                    timeCutoff = now - 30 * 24 * 60 * 60 * 1000; // 30 days
                    break;
                case 'all':
                default:
                    timeCutoff = 0; // All time
            }
            const activeUsers = allUsers.filter(user => user.lastActivity >= timeCutoff);
            const connectedWallets = allUsers.filter(user => user.walletEverConnected).length;
            const newUsers = allUsers.filter(user => user.firstSeenTimestamp >= timeCutoff).length;
            // Count transactions by checking users with lastTransactionAmount + timestamp
            const transactions = allUsers.filter(user => user.lastTransactionTimestamp && user.lastTransactionTimestamp >= timeCutoff).length;
            const analyticsData = {
                totalUsers: allUsers.length,
                activeUsers: activeUsers.length,
                connectedWallets,
                totalTransactions: transactions,
                commandUsage: Object.assign({}, this.commandUsage),
                newUsers,
                period,
                timestamp: now
            };
            // Store analytics data for historical comparison
            if (period === 'day') {
                this.dailyStats.push(analyticsData);
                if (this.dailyStats.length > 30)
                    this.dailyStats.shift(); // Keep last 30 days
            }
            else if (period === 'week') {
                this.weeklyStats.push(analyticsData);
                if (this.weeklyStats.length > 12)
                    this.weeklyStats.shift(); // Keep last 12 weeks
            }
            else if (period === 'month') {
                this.monthlyStats.push(analyticsData);
                if (this.monthlyStats.length > 12)
                    this.monthlyStats.shift(); // Keep last 12 months
            }
            return analyticsData;
        });
    }
    /**
     * Display analytics dashboard
     */
    static displayAnalytics(chatId, period = 'day') {
        return __awaiter(this, void 0, void 0, function* () {
            // Ensure only admins can access analytics
            if (!(0, utils_1.isAdmin)(chatId)) {
                yield bot_1.bot.sendMessage(chatId, '⛔ Access denied. Only administrators can access analytics.');
                return;
            }
            const analytics = yield this.collectAnalytics(period);
            // Prepare dashboard message
            let message = `📊 *Bot Analytics Dashboard*\n\n`;
            // Time period
            switch (period) {
                case 'day':
                    message += '*Period:* Last 24 hours\n';
                    break;
                case 'week':
                    message += '*Period:* Last 7 days\n';
                    break;
                case 'month':
                    message += '*Period:* Last 30 days\n';
                    break;
                case 'all':
                    message += '*Period:* All time\n';
                    break;
            }
            message += `\n*User Statistics*\n`;
            message += `👥 Total Users: ${analytics.totalUsers}\n`;
            message += `👤 Active Users: ${analytics.activeUsers}\n`;
            message += `🆕 New Users: ${analytics.newUsers}\n`;
            message += `💼 Connected Wallets: ${analytics.connectedWallets}\n`;
            message += `💸 Total Transactions: ${analytics.totalTransactions}\n`;
            message += `\n*Most Used Commands*\n`;
            // Get top 5 commands by usage
            const topCommands = Object.entries(analytics.commandUsage)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            if (topCommands.length > 0) {
                topCommands.forEach(([command, count], index) => {
                    message += `${index + 1}. /${command}: ${count} uses\n`;
                });
            }
            else {
                message += `No command usage data available yet.\n`;
            }
            // Send dashboard
            yield bot_1.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '📅 Day', callback_data: 'analytics_day' },
                            { text: '📆 Week', callback_data: 'analytics_week' },
                            { text: '📅 Month', callback_data: 'analytics_month' },
                            { text: '🔄 All Time', callback_data: 'analytics_all' }
                        ]
                    ]
                }
            });
        });
    }
    /**
     * Handle analytics callback queries
     */
    static handleAnalyticsCallback(query) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!query.data || !query.message)
                return;
            const chatId = query.message.chat.id;
            const action = query.data.replace('analytics_', '');
            // Ensure only admins can access analytics
            if (!(0, utils_1.isAdmin)(chatId)) {
                yield bot_1.bot.answerCallbackQuery(query.id, { text: '⛔ Access denied. Only administrators can access analytics.', show_alert: true });
                return;
            }
            switch (action) {
                case 'day':
                case 'week':
                case 'month':
                case 'all':
                    yield bot_1.bot.answerCallbackQuery(query.id);
                    yield bot_1.bot.deleteMessage(chatId, query.message.message_id);
                    yield this.displayAnalytics(chatId, action);
                    break;
                default:
                    yield bot_1.bot.answerCallbackQuery(query.id, { text: 'Invalid action' });
            }
        });
    }
}
exports.AnalyticsService = AnalyticsService;
AnalyticsService.commandUsage = {};
AnalyticsService.dailyStats = [];
AnalyticsService.weeklyStats = [];
AnalyticsService.monthlyStats = [];
/**
 * Handle the /analytics command
 * Admin-only command to view the analytics dashboard
 */
function handleAnalyticsCommand(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Ensure only admins can access this command
        if (!(0, utils_1.isAdmin)(chatId)) {
            console.log(`[ADMIN] Unauthorized access attempt to /analytics by user ${chatId}`);
            return; // Silently fail for non-admins - don't even acknowledge the command
        }
        yield AnalyticsService.displayAnalytics(chatId, 'day');
    });
}
exports.handleAnalyticsCommand = handleAnalyticsCommand;
//# sourceMappingURL=analytics-service.js.map