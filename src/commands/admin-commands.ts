import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand } from './base-command';
import { ErrorHandler, ErrorType } from '../error-handler';
import { bot } from '../bot';
import { getAllTrackedUsers, getAllConnectedUsers, getTransactionSubmission, updateTransactionStatus } from '../ton-connect/storage';

/**
 * Command to view and manage errors (admin only)
 */
export class ErrorsCommand extends BaseCommand {
    constructor() {
        super(
            'errors',   // command name
            true,      // admin-only
            'View recent bot errors' // description
        );
    }
    
    /**
     * Execute the errors command
     */
    protected async executeCommand(msg: TelegramBot.Message, match?: RegExpExecArray | null): Promise<void> {
        let limit = 10; // Default limit
            
        // Parse limit from command if provided
        if (match && match[1]) {
            const parsedLimit = parseInt(match[1], 10);
            if (!isNaN(parsedLimit) && parsedLimit > 0) {
                limit = Math.min(parsedLimit, 50); // Cap at 50 errors
            }
        }
        
        await ErrorHandler.sendErrorReport(msg.chat.id, limit);
    }
    
    /**
     * Override to get a custom regex pattern that includes an optional limit parameter
     */
    getRegexPattern(): RegExp {
        return /\/errors(?:\s+(\d+))?/;
    }
}

/**
 * Command to view analytics (admin only)
 */
export class AnalyticsCommand extends BaseCommand {
    constructor() {
        super(
            'analytics', // command name
            true,        // admin-only
            'View bot usage statistics' // description
        );
    }
    
    /**
     * Execute the analytics command
     */
    protected async executeCommand(msg: TelegramBot.Message): Promise<void> {
        try {
            const chatId = msg.chat.id;
            
            // Get user statistics
            const allUsers = await getAllTrackedUsers();
            const connectedUsers = await getAllConnectedUsers();
            
            // Calculate statistics
            const totalUsers = allUsers.length;
            const usersWithWallets = connectedUsers.length;
            const walletsPercentage = totalUsers > 0 ? ((usersWithWallets / totalUsers) * 100).toFixed(1) : '0';
            
            // Calculate active users (active in the last 24 hours)
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            const activeUsers = allUsers.filter(user => user.lastActivity > oneDayAgo).length;
            const activePercentage = totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : '0';
            
            // Calculate retention (users who have returned after their first day)
            const usersWithMultipleVisits = allUsers.filter(user => {
                // If last activity is more than 1 day after first seen, they've returned
                return (user.lastActivity - user.firstSeenTimestamp) > (24 * 60 * 60 * 1000);
            }).length;
            const retentionRate = totalUsers > 0 ? ((usersWithMultipleVisits / totalUsers) * 100).toFixed(1) : '0';
            
            // Build the analytics message
            let message = `📊 *Bot Analytics Dashboard* 📊\n\n`;
            message += `👥 *User Statistics*\n`;
            message += `• Total Users: ${totalUsers}\n`;
            message += `• Users with Wallets: ${usersWithWallets} (${walletsPercentage}%)\n`;
            message += `• Active Users (24h): ${activeUsers} (${activePercentage}%)\n`;
            message += `• Retention Rate: ${retentionRate}%\n\n`;
            
            // Get the newest users (joined in the last 24 hours)
            const newUsers = allUsers.filter(user => user.firstSeenTimestamp > oneDayAgo).length;
            message += `• New Users (24h): ${newUsers}\n\n`;
            
            // Additional metrics could be added here as the bot evolves
            
            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (error: any) {
            ErrorHandler.handleError({
                type: ErrorType.COMMAND_HANDLER,
                message: `Error generating analytics: ${error?.message || String(error)}`,
                command: this.name,
                userId: msg.from?.id,
                timestamp: Date.now(),
                stack: error?.stack
            });
            throw error; // Re-throw to let the base command error handler manage the user message
        }
    }
}

/**
 * Command to schedule a message to all users or a specific segment
 */
export class ScheduleMessageCommand extends BaseCommand {
    constructor() {
        super(
            'schedule', // command name
            true,       // admin-only
            'Schedule a message to be sent later' // description
        );
    }
    
    /**
     * Custom regex to handle the schedule command format
     * /schedule <time> <segment> <message>
     */
    getRegexPattern(): RegExp {
        return /\/schedule\s+(\d{1,2}:\d{2})\s+(all|wallet|new)\s+(.*)/s;
    }
    
    /**
     * Execute the schedule message command
     */
    protected async executeCommand(msg: TelegramBot.Message, match?: RegExpExecArray | null): Promise<void> {
        if (!match || match.length < 4) {
            await bot.sendMessage(msg.chat.id, 
                "⚠️ Invalid format. Please use: /schedule <time> <segment> <message>\n" +
                "Example: /schedule 15:30 all Hello everyone!\n\n" +
                "Segments: all, wallet (users with wallets), new (users from last 24h)"
            );
            return;
        }
        
        const time = match[1];
        const segment = match[2];
        const message = match[3];
        
        // For this implementation, we'll simulate scheduling by confirming the request
        // In a real implementation, this would save the schedule to a database and use
        // a task scheduler to send it at the specified time
        
        const segmentNames = {
            'all': 'All Users',
            'wallet': 'Users with Connected Wallets',
            'new': 'New Users (last 24h)'
        };
        
        await bot.sendMessage(msg.chat.id, 
            `✅ Message scheduled for ${time}\n` +
            `Target audience: ${segmentNames[segment as keyof typeof segmentNames]}\n` +
            `Message content:\n${message}\n\n` +
            `Note: This is a simulation. In a production environment, this message would be sent at the scheduled time.`
        );
    }
}
