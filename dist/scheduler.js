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
exports.handleScheduleCommand = exports.scheduleMessage = void 0;
const utils_1 = require("./utils");
const error_boundary_1 = require("./error-boundary");
const storage_1 = require("./ton-connect/storage");
// In-memory storage for scheduled tasks
const scheduledTasks = [];
/**
 * Parse time string to milliseconds
 * Supports: 10s (seconds), 5m (minutes), 2h (hours)
 *
 * @param timeStr Time string like "10s", "5m", "2h"
 * @returns Milliseconds or null if invalid format
 */
function parseTimeString(timeStr) {
    const match = timeStr.match(/^(\d+)([smh])$/i);
    if (!match || !match[1] || !match[2])
        return null;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    switch (unit) {
        case 's': return value * 1000; // seconds
        case 'm': return value * 60 * 1000; // minutes
        case 'h': return value * 60 * 60 * 1000; // hours
        default: return null;
    }
}
/**
 * Schedule a message to be sent later
 *
 * @param delay Milliseconds to delay the message
 * @param targetUsers Target audience for the message
 * @param message Message text to send
 * @param specificUserId Optional specific user ID for targeted messages
 * @param createdBy Admin user ID who scheduled the message
 * @returns Task ID and execution time
 */
function scheduleMessage(delay, targetUsers, message, specificUserId, createdBy, botId = '1' // Default to '1' for backward compatibility
) {
    const now = Date.now();
    const executeAt = now + delay;
    const taskId = `task_${now}_${Math.random().toString(36).substring(2, 9)}`;
    const task = {
        id: taskId,
        executeAt,
        targetUsers,
        specificUserId,
        message,
        executed: false,
        createdBy,
        botId
    };
    scheduledTasks.push(task);
    // Set timeout to execute the task
    setTimeout(() => executeTask(taskId), delay);
    return {
        taskId,
        executionTime: new Date(executeAt)
    };
}
exports.scheduleMessage = scheduleMessage;
/**
 * Execute a scheduled task by its ID
 *
 * @param taskId The task ID to execute
 */
function executeTask(taskId) {
    return __awaiter(this, void 0, void 0, function* () {
        const taskIndex = scheduledTasks.findIndex(task => task.id === taskId);
        if (taskIndex === -1)
            return;
        const task = scheduledTasks[taskIndex];
        if (!task || task.executed)
            return;
        try {
            // Mark as executed immediately to prevent double execution
            task.executed = true;
            switch (task.targetUsers) {
                case 'specific':
                    if (task.specificUserId) {
                        yield (0, error_boundary_1.safeSendMessage)(task.specificUserId, `📣 *Scheduled Message*\n\n${task.message}`, { parse_mode: 'Markdown' }, task.botId);
                        // Notify admin of successful delivery
                        yield notifyAdmin(task.createdBy, `✅ Scheduled message delivered to user ${task.specificUserId}`);
                    }
                    break;
                case 'all':
                    // Send to all users who have ever interacted with the bot
                    const allUsers = yield (0, storage_1.getAllTrackedUsers)();
                    yield sendToMultipleUsers(allUsers.map(user => user.chatId), task);
                    break;
                case 'active':
                    // Send only to users with connected wallets
                    const activeUsers = yield (0, storage_1.getAllConnectedUsers)();
                    yield sendToMultipleUsers(activeUsers.map(user => user.chatId), task);
                    break;
                case 'inactive':
                    // Send to users without wallet connections
                    const allTracked = yield (0, storage_1.getAllTrackedUsers)();
                    const connectedUserIds = new Set((yield (0, storage_1.getAllConnectedUsers)()).map(user => user.chatId));
                    const inactiveUsers = allTracked
                        .filter(user => !connectedUserIds.has(user.chatId))
                        .map(user => user.chatId);
                    yield sendToMultipleUsers(inactiveUsers, task);
                    break;
            }
        }
        catch (error) {
            console.error(`Error executing scheduled task ${taskId}:`, error);
            // Notify admin of failure
            try {
                yield notifyAdmin(task.createdBy, `❌ Error sending scheduled message: ${error instanceof Error ? error.message : String(error)}`);
            }
            catch (notifyError) {
                console.error('Failed to notify admin about task failure:', notifyError);
            }
        }
        // Remove executed task from the array to free up memory
        scheduledTasks.splice(taskIndex, 1);
    });
}
/**
 * Send a message to multiple users
 *
 * @param userIds Array of user chat IDs
 * @param task The scheduled task to execute
 */
function sendToMultipleUsers(userIds, task) {
    return __awaiter(this, void 0, void 0, function* () {
        let successCount = 0;
        let failureCount = 0;
        for (const userId of userIds) {
            try {
                yield (0, error_boundary_1.safeSendMessage)(userId, `📣 *Scheduled Message*\n\n${task.message}`, { parse_mode: 'Markdown' });
                successCount++;
            }
            catch (error) {
                console.error(`Failed to send scheduled message to user ${userId}:`, error);
                failureCount++;
            }
            // Small delay to avoid hitting Telegram rate limits
            yield new Promise(resolve => setTimeout(resolve, 50));
        }
        // Notify admin of batch completion
        yield notifyAdmin(task.createdBy, `✅ Scheduled message batch complete\n\nSuccessful: ${successCount}\nFailed: ${failureCount}\nTotal recipients: ${userIds.length}`);
    });
}
/**
 * Notify an admin about task execution status
 *
 * @param adminId ID of the admin to notify
 * @param message Notification message
 */
function notifyAdmin(adminId, message, botId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, error_boundary_1.safeSendMessage)(adminId, message, undefined, botId);
        }
        catch (error) {
            console.error(`Failed to notify admin ${adminId}:`, error);
        }
    });
}
/**
 * Handle the /schedule command for scheduling messages
 * This is an admin-only command
 *
 * @param msg Telegram message object
 */
function handleScheduleCommand(msg, botId = '1') {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        // Check if user is admin for this specific bot
        if (!(0, utils_1.isAdmin)(chatId, botId)) {
            // Silently ignore if not admin - user shouldn't know this command exists
            return;
        }
        const text = msg.text || '';
        const commandArgs = text.split(/\s+/);
        // Remove command itself
        commandArgs.shift();
        if (commandArgs.length < 2) {
            yield (0, error_boundary_1.safeSendMessage)(chatId, "⚠️ *Incorrect Format*\n\n" +
                "Usage:\n" +
                "- `/schedule [time] [message]` - Send to all users\n" +
                "- `/schedule [time] -active [message]` - Send to users with wallet connected\n" +
                "- `/schedule [time] -inactive [message]` - Send to users without wallet connected\n" +
                "- `/schedule [time] [user_id] [message]` - Send to specific user\n\n" +
                "Time format: 10s (seconds), 5m (minutes), 2h (hours)\n\n" +
                "Examples:\n" +
                "- `/schedule 30s Hello everyone!`\n" +
                "- `/schedule 5m -active Remember to check your wallet balance`\n" +
                "- `/schedule 1h -inactive Please connect your wallet`\n" +
                "- `/schedule 10s 123456789 This is a private message`", { parse_mode: 'Markdown' });
            return;
        }
        // Parse time
        const timeArg = commandArgs.shift() || '';
        const delay = parseTimeString(timeArg);
        if (delay === null) {
            yield (0, error_boundary_1.safeSendMessage)(chatId, "⚠️ *Invalid Time Format*\n\n" +
                "Please use a valid time format: 10s (seconds), 5m (minutes), 2h (hours)", { parse_mode: 'Markdown' }, botId);
            return;
        }
        // Check for special flags
        let targetUsers = 'all';
        let specificUserId = undefined;
        if (commandArgs[0] === '-active') {
            targetUsers = 'active';
            commandArgs.shift();
        }
        else if (commandArgs[0] === '-inactive') {
            targetUsers = 'inactive';
            commandArgs.shift();
        }
        else if (commandArgs[0] && /^\d+$/.test(commandArgs[0])) {
            // If first argument is a number, assume it's a user ID
            targetUsers = 'specific';
            specificUserId = parseInt(commandArgs[0], 10);
            commandArgs.shift();
        }
        if (commandArgs.length === 0) {
            yield (0, error_boundary_1.safeSendMessage)(chatId, "⚠️ Please provide a message to send", undefined, botId);
            return;
        }
        // Combine remaining arguments as the message
        const message = commandArgs.join(' ');
        // Schedule the message
        const { taskId, executionTime } = scheduleMessage(delay, targetUsers, message, specificUserId, chatId, botId);
        // Create user-friendly confirmation
        let confirmationMsg = `✅ *Message Scheduled*\n\n`;
        confirmationMsg += `⏰ Execution time: ${executionTime.toLocaleString()}\n`;
        confirmationMsg += `🆔 Task ID: \`${taskId}\`\n\n`;
        switch (targetUsers) {
            case 'specific':
                confirmationMsg += `📧 Target: Specific user (ID: ${specificUserId})\n`;
                break;
            case 'all':
                confirmationMsg += `📧 Target: All users\n`;
                break;
            case 'active':
                confirmationMsg += `📧 Target: Users with wallet connected\n`;
                break;
            case 'inactive':
                confirmationMsg += `📧 Target: Users without wallet connected\n`;
                break;
        }
        confirmationMsg += `\n📝 Message:\n${message}`;
        yield (0, error_boundary_1.safeSendMessage)(chatId, confirmationMsg, { parse_mode: 'Markdown' }, botId);
    });
}
exports.handleScheduleCommand = handleScheduleCommand;
//# sourceMappingURL=scheduler.js.map