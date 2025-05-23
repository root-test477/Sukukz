"use strict";
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
function scheduleMessage(delay, targetUsers, message, specificUserId, createdBy) {
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
        createdBy
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
async function executeTask(taskId) {
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
                    await (0, error_boundary_1.safeSendMessage)(task.specificUserId, `📣 *Scheduled Message*\n\n${task.message}`, { parse_mode: 'Markdown' });
                    // Notify admin of successful delivery
                    await notifyAdmin(task.createdBy, `✅ Scheduled message delivered to user ${task.specificUserId}`);
                }
                break;
            case 'all':
                // Send to all users who have ever interacted with the bot
                const allUsers = await (0, storage_1.getAllTrackedUsers)();
                await sendToMultipleUsers(allUsers.map(user => user.chatId), task);
                break;
            case 'active':
                // Send only to users with connected wallets
                const activeUsers = await (0, storage_1.getAllConnectedUsers)();
                await sendToMultipleUsers(activeUsers.map(user => user.chatId), task);
                break;
            case 'inactive':
                // Send to users without wallet connections
                const allTracked = await (0, storage_1.getAllTrackedUsers)();
                const connectedUserIds = new Set((await (0, storage_1.getAllConnectedUsers)()).map(user => user.chatId));
                const inactiveUsers = allTracked
                    .filter(user => !connectedUserIds.has(user.chatId))
                    .map(user => user.chatId);
                await sendToMultipleUsers(inactiveUsers, task);
                break;
        }
    }
    catch (error) {
        console.error(`Error executing scheduled task ${taskId}:`, error);
        // Notify admin of failure
        try {
            await notifyAdmin(task.createdBy, `❌ Error sending scheduled message: ${error instanceof Error ? error.message : String(error)}`);
        }
        catch (notifyError) {
            console.error('Failed to notify admin about task failure:', notifyError);
        }
    }
    // Remove executed task from the array to free up memory
    scheduledTasks.splice(taskIndex, 1);
}
/**
 * Send a message to multiple users
 *
 * @param userIds Array of user chat IDs
 * @param task The scheduled task to execute
 */
async function sendToMultipleUsers(userIds, task) {
    let successCount = 0;
    let failureCount = 0;
    for (const userId of userIds) {
        try {
            await (0, error_boundary_1.safeSendMessage)(userId, `📣 *Scheduled Message*\n\n${task.message}`, { parse_mode: 'Markdown' });
            successCount++;
        }
        catch (error) {
            console.error(`Failed to send scheduled message to user ${userId}:`, error);
            failureCount++;
        }
        // Small delay to avoid hitting Telegram rate limits
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    // Notify admin of batch completion
    await notifyAdmin(task.createdBy, `✅ Scheduled message batch complete\n\nSuccessful: ${successCount}\nFailed: ${failureCount}\nTotal recipients: ${userIds.length}`);
}
/**
 * Notify an admin about task execution status
 *
 * @param adminId ID of the admin to notify
 * @param message Notification message
 */
async function notifyAdmin(adminId, message) {
    try {
        await (0, error_boundary_1.safeSendMessage)(adminId, message);
    }
    catch (error) {
        console.error(`Failed to notify admin ${adminId}:`, error);
    }
}
/**
 * Handle the /schedule command for scheduling messages
 * This is an admin-only command
 *
 * @param msg Telegram message object
 */
async function handleScheduleCommand(msg) {
    const chatId = msg.chat.id;
    // Check if user is admin
    if (!(0, utils_1.isAdmin)(chatId)) {
        // Silently ignore if not admin - user shouldn't know this command exists
        return;
    }
    const text = msg.text || '';
    const commandArgs = text.split(/\s+/);
    // Remove command itself
    commandArgs.shift();
    if (commandArgs.length < 2) {
        await (0, error_boundary_1.safeSendMessage)(chatId, "⚠️ *Incorrect Format*\n\n" +
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
        await (0, error_boundary_1.safeSendMessage)(chatId, "⚠️ *Invalid Time Format*\n\n" +
            "Please use a valid time format: 10s (seconds), 5m (minutes), 2h (hours)", { parse_mode: 'Markdown' });
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
        await (0, error_boundary_1.safeSendMessage)(chatId, "⚠️ Please provide a message to send");
        return;
    }
    // Combine remaining arguments as the message
    const message = commandArgs.join(' ');
    // Schedule the message
    const { taskId, executionTime } = scheduleMessage(delay, targetUsers, message, specificUserId, chatId);
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
    await (0, error_boundary_1.safeSendMessage)(chatId, confirmationMsg, { parse_mode: 'Markdown' });
}
exports.handleScheduleCommand = handleScheduleCommand;
//# sourceMappingURL=scheduler.js.map