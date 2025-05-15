import TelegramBot from 'node-telegram-bot-api';
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
export declare class AnalyticsService {
    private static commandUsage;
    private static dailyStats;
    private static weeklyStats;
    private static monthlyStats;
    /**
     * Track command usage
     */
    static trackCommand(command: string): void;
    /**
     * Collect current analytics data
     */
    static collectAnalytics(period?: 'day' | 'week' | 'month' | 'all'): Promise<AnalyticsData>;
    /**
     * Display analytics dashboard
     */
    static displayAnalytics(chatId: number, period?: 'day' | 'week' | 'month' | 'all'): Promise<void>;
    /**
     * Handle analytics callback queries
     */
    static handleAnalyticsCallback(query: TelegramBot.CallbackQuery): Promise<void>;
}
/**
 * Handle the /analytics command
 * Admin-only command to view the analytics dashboard
 */
export declare function handleAnalyticsCommand(msg: TelegramBot.Message): Promise<void>;
