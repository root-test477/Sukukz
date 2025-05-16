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
exports.ScheduleMessageCommand = exports.AnalyticsCommand = exports.ErrorsCommand = void 0;
const base_command_1 = require("./base-command");
const error_handler_1 = require("../error-handler");
const bot_1 = require("../bot");
const storage_1 = require("../ton-connect/storage");
/**
 * Command to view and manage errors (admin only)
 */
class ErrorsCommand extends base_command_1.BaseCommand {
    constructor() {
        super('errors', // command name
        true, // admin-only
        'View recent bot errors' // description
        );
    }
    /**
     * Execute the errors command
     */
    executeCommand(msg, match) {
        return __awaiter(this, void 0, void 0, function* () {
            let limit = 10; // Default limit
            // Parse limit from command if provided
            if (match && match[1]) {
                const parsedLimit = parseInt(match[1], 10);
                if (!isNaN(parsedLimit) && parsedLimit > 0) {
                    limit = Math.min(parsedLimit, 50); // Cap at 50 errors
                }
            }
            yield error_handler_1.ErrorHandler.sendErrorReport(msg.chat.id, limit);
        });
    }
    /**
     * Override to get a custom regex pattern that includes an optional limit parameter
     */
    getRegexPattern() {
        return /\/errors(?:\s+(\d+))?/;
    }
}
exports.ErrorsCommand = ErrorsCommand;
/**
 * Command to view analytics (admin only)
 */
class AnalyticsCommand extends base_command_1.BaseCommand {
    constructor() {
        super('analytics', // command name
        true, // admin-only
        'View bot usage statistics' // description
        );
    }
    /**
     * Execute the analytics command
     */
    executeCommand(msg) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const chatId = msg.chat.id;
                // Get user statistics
                const allUsers = yield (0, storage_1.getAllTrackedUsers)();
                const connectedUsers = yield (0, storage_1.getAllConnectedUsers)();
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
                yield bot_1.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            }
            catch (error) {
                error_handler_1.ErrorHandler.handleError({
                    type: error_handler_1.ErrorType.COMMAND_HANDLER,
                    message: `Error generating analytics: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`,
                    command: this.name,
                    userId: (_a = msg.from) === null || _a === void 0 ? void 0 : _a.id,
                    timestamp: Date.now(),
                    stack: error === null || error === void 0 ? void 0 : error.stack
                });
                throw error; // Re-throw to let the base command error handler manage the user message
            }
        });
    }
}
exports.AnalyticsCommand = AnalyticsCommand;
/**
 * Command to schedule a message to all users or a specific segment
 */
class ScheduleMessageCommand extends base_command_1.BaseCommand {
    constructor() {
        super('schedule', // command name
        true, // admin-only
        'Schedule a message to be sent later' // description
        );
    }
    /**
     * Custom regex to handle the schedule command format
     * /schedule <time> <segment> <message>
     */
    getRegexPattern() {
        return /\/schedule\s+(\d{1,2}:\d{2})\s+(all|wallet|new)\s+(.*)/s;
    }
    /**
     * Execute the schedule message command
     */
    executeCommand(msg, match) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!match || match.length < 4) {
                yield bot_1.bot.sendMessage(msg.chat.id, "⚠️ Invalid format. Please use: /schedule <time> <segment> <message>\n" +
                    "Example: /schedule 15:30 all Hello everyone!\n\n" +
                    "Segments: all, wallet (users with wallets), new (users from last 24h)");
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
            yield bot_1.bot.sendMessage(msg.chat.id, `✅ Message scheduled for ${time}\n` +
                `Target audience: ${segmentNames[segment]}\n` +
                `Message content:\n${message}\n\n` +
                `Note: This is a simulation. In a production environment, this message would be sent at the scheduled time.`);
        });
    }
}
exports.ScheduleMessageCommand = ScheduleMessageCommand;
//# sourceMappingURL=admin-commands.js.map