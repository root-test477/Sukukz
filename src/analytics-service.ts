import { bot } from './bot';
import { UserData, TransactionSubmission, SupportMessage, getAllTrackedUsers } from './ton-connect/storage';
import TelegramBot from 'node-telegram-bot-api';
import { isAdmin } from './utils';

/**
 * Analytics Data Interface
 */
export interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  connectedWallets: number;
  totalTransactions: number;
  commandUsage: Record<string, number>;
  newUsers: number;
  period: 'day' | 'week' | 'month' | 'all';
  timestamp: number;
}

/**
 * Service for collecting and displaying analytics data
 */
export class AnalyticsService {
  private static commandUsage: Record<string, number> = {};
  private static dailyStats: AnalyticsData[] = [];
  private static weeklyStats: AnalyticsData[] = [];
  private static monthlyStats: AnalyticsData[] = [];

  /**
   * Track command usage
   */
  public static trackCommand(command: string): void {
    const cleanCommand = command.startsWith('/') ? command.substring(1) : command;

    if (!this.commandUsage[cleanCommand]) {
      this.commandUsage[cleanCommand] = 0;
    }

    this.commandUsage[cleanCommand]++;
  }

  /**
   * Collect current analytics data
   */
  public static async collectAnalytics(period: 'day' | 'week' | 'month' | 'all' = 'day'): Promise<AnalyticsData> {
    const now = Date.now();
    const allUsers = await getAllTrackedUsers();

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
    const transactions = allUsers.filter(user =>
      user.lastTransactionTimestamp && user.lastTransactionTimestamp >= timeCutoff
    ).length;

    const analyticsData: AnalyticsData = {
      totalUsers: allUsers.length,
      activeUsers: activeUsers.length,
      connectedWallets,
      totalTransactions: transactions,
      commandUsage: { ...this.commandUsage },
      newUsers,
      period,
      timestamp: now
    };

    // Store analytics data for historical comparison
    if (period === 'day') {
      this.dailyStats.push(analyticsData);
      if (this.dailyStats.length > 30) this.dailyStats.shift(); // Keep last 30 days
    } else if (period === 'week') {
      this.weeklyStats.push(analyticsData);
      if (this.weeklyStats.length > 12) this.weeklyStats.shift(); // Keep last 12 weeks
    } else if (period === 'month') {
      this.monthlyStats.push(analyticsData);
      if (this.monthlyStats.length > 12) this.monthlyStats.shift(); // Keep last 12 months
    }

    return analyticsData;
  }

  /**
   * Display analytics dashboard
   */
  public static async displayAnalytics(chatId: number, period: 'day' | 'week' | 'month' | 'all' = 'day'): Promise<void> {
    // Ensure only admins can access analytics
    if (!isAdmin(chatId)) {
      await bot.sendMessage(chatId, '⛔ Access denied. Only administrators can access analytics.');
      return;
    }

    const analytics = await this.collectAnalytics(period);

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
    } else {
      message += `No command usage data available yet.\n`;
    }

    // Send dashboard
    await bot.sendMessage(chatId, message, {
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
  }

  /**
   * Handle analytics callback queries
   */
  public static async handleAnalyticsCallback(query: TelegramBot.CallbackQuery): Promise<void> {
    if (!query.data || !query.message) return;

    const chatId = query.message.chat.id;
    const action = query.data.replace('analytics_', '');

    // Ensure only admins can access analytics
    if (!isAdmin(chatId)) {
      await bot.answerCallbackQuery(query.id, { text: '⛔ Access denied. Only administrators can access analytics.', show_alert: true });
      return;
    }

    switch (action) {
      case 'day':
      case 'week':
      case 'month':
      case 'all':
        await bot.answerCallbackQuery(query.id);
        await bot.deleteMessage(chatId, query.message.message_id);
        await this.displayAnalytics(chatId, action as 'day' | 'week' | 'month' | 'all');
        break;

      default:
        await bot.answerCallbackQuery(query.id, { text: 'Invalid action' });
    }
  }
}

/**
 * Handle the /analytics command
 */
export async function handleAnalyticsCommand(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  await AnalyticsService.displayAnalytics(chatId, 'day');
}
