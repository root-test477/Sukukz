import TelegramBot from 'node-telegram-bot-api';
import { bot } from './bot';
import { getRedisClient } from './ton-connect/storage';
import { withErrorHandling } from './error-handler';

interface ScheduledMessage {
    id: string;
    content: string;
    scheduledTime: number;
    sentTime?: number;
    targetUsers: number[] | 'all' | 'connected' | 'active';
    createdBy: number;
    parseMode?: string;
    status: 'pending' | 'sent' | 'failed';
    errorMessage?: string;
}

/**
 * Schedule a message to be sent at a specific time
 */
export async function scheduleMessage(
    content: string,
    scheduledTime: Date,
    targetUsers: number[] | 'all' | 'connected' | 'active',
    createdBy: number,
    parseMode?: 'Markdown' | 'HTML'
): Promise<string> {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const message: ScheduledMessage = {
        id,
        content,
        scheduledTime: scheduledTime.getTime(),
        targetUsers,
        createdBy,
        parseMode,
        status: 'pending'
    };
    
    const redisClient = await getRedisClient();
    
    // Store message in Redis
    await redisClient.hSet('scheduled_messages', id, JSON.stringify(message));
    
    // Add to sorted set by scheduled time
    await redisClient.zAdd('scheduled_messages_by_time', [{
        score: scheduledTime.getTime(),
        value: id
    }]);
    
    console.log(`Scheduled message ${id} for ${scheduledTime.toISOString()}`);
    return id;
}

/**
 * Cancel a scheduled message
 */
export async function cancelScheduledMessage(id: string): Promise<boolean> {
    const redisClient = await getRedisClient();
    
    // Check if message exists
    const messageData = await redisClient.hGet('scheduled_messages', id);
    if (!messageData) return false;
    
    // Remove from Redis
    await redisClient.hDel('scheduled_messages', id);
    await redisClient.zRem('scheduled_messages_by_time', id);
    
    console.log(`Cancelled scheduled message ${id}`);
    return true;
}

/**
 * Get all scheduled messages
 */
export async function getScheduledMessages(): Promise<ScheduledMessage[]> {
    const redisClient = await getRedisClient();
    
    const messagesData = await redisClient.hGetAll('scheduled_messages');
    const messages: ScheduledMessage[] = [];
    
    for (const data of Object.values(messagesData)) {
        messages.push(JSON.parse(data));
    }
    
    // Sort by scheduled time
    return messages.sort((a, b) => a.scheduledTime - b.scheduledTime);
}

/**
 * Get target user IDs based on targeting criteria
 */
async function getTargetUserIds(targetUsers: number[] | 'all' | 'connected' | 'active'): Promise<number[]> {
    const redisClient = await getRedisClient();
    
    if (Array.isArray(targetUsers)) {
        return targetUsers;
    }
    
    if (targetUsers === 'all') {
        // Get all users who have ever interacted with the bot
        const allUsers = await redisClient.hGetAll('all_users');
        return Object.keys(allUsers).map(id => parseInt(id));
    }
    
    if (targetUsers === 'connected') {
        // Get users who have connected wallets
        const connectedUsers = await redisClient.hGetAll('connected_users');
        return Object.keys(connectedUsers).map(id => parseInt(id));
    }
    
    if (targetUsers === 'active') {
        // Get users active in the last 24 hours
        const allUsers = await redisClient.hGetAll('all_users');
        const activeUsers: number[] = [];
        
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        
        for (const [id, data] of Object.entries(allUsers)) {
            const userData = JSON.parse(data);
            if (userData.lastActivity && userData.lastActivity > oneDayAgo) {
                activeUsers.push(parseInt(id));
            }
        }
        
        return activeUsers;
    }
    
    return [];
}

/**
 * Check for and send any due scheduled messages
 */
export async function processScheduledMessages(): Promise<void> {
    const redisClient = await getRedisClient();
    
    const now = Date.now();
    
    // Get all messages scheduled for now or earlier
    const dueMessageIds = await redisClient.zRangeByScore('scheduled_messages_by_time', 0, now);
    
    if (dueMessageIds.length === 0) return;
    
    console.log(`Found ${dueMessageIds.length} due scheduled messages`);
    
    for (const id of dueMessageIds) {
        // Get message data
        const messageData = await redisClient.hGet('scheduled_messages', id);
        if (!messageData) continue;
        
        const message: ScheduledMessage = JSON.parse(messageData);
        
        try {
            // Get target users
            const targetUserIds = await getTargetUserIds(message.targetUsers);
            
            console.log(`Sending scheduled message ${id} to ${targetUserIds.length} users`);
            
            // Send to each user
            let successCount = 0;
            let failureCount = 0;
            
            for (const userId of targetUserIds) {
                try {
                    await bot.sendMessage(userId, message.content, {
                        parse_mode: message.parseMode as TelegramBot.ParseMode
                    });
                    successCount++;
                } catch (error) {
                    failureCount++;
                    console.error(`Failed to send message to user ${userId}:`, error);
                }
                
                // Small delay to avoid hitting rate limits
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            // Update message status
            message.status = failureCount === targetUserIds.length ? 'failed' : 'sent';
            message.sentTime = Date.now();
            
            if (failureCount > 0) {
                message.errorMessage = `Failed to send to ${failureCount} of ${targetUserIds.length} users`;
            }
            
            // Notify admin of completion
            try {
                await bot.sendMessage(
                    message.createdBy,
                    `\u2705 Scheduled message delivered:\n\n` +
                    `Message ID: ${message.id}\n` +
                    `Successfully sent to: ${successCount} users\n` +
                    `Failed deliveries: ${failureCount} users\n` +
                    `----\n${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`
                );
            } catch (error) {
                console.error('Failed to notify admin of message completion:', error);
            }
            
        } catch (error) {
            console.error(`Error processing scheduled message ${id}:`, error);
            
            message.status = 'failed';
            message.errorMessage = error instanceof Error ? error.message : String(error);
            
            // Notify admin of failure
            try {
                await bot.sendMessage(
                    message.createdBy,
                    `\u274c Scheduled message failed to deliver:\n\n` +
                    `Message ID: ${message.id}\n` +
                    `Error: ${message.errorMessage}\n` +
                    `----\n${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`
                );
            } catch (adminError) {
                console.error('Failed to notify admin of message failure:', adminError);
            }
        }
        
        // Update message in Redis
        await redisClient.hSet('scheduled_messages', id, JSON.stringify(message));
        
        // Remove from sorted set
        await redisClient.zRem('scheduled_messages_by_time', id);
    }
}

/**
 * Set up periodic checking of scheduled messages
 * Call this during application initialization
 */
export function setupScheduledMessagesProcessor(): NodeJS.Timeout {
    // Check for scheduled messages every minute
    const interval = setInterval(() => {
        processScheduledMessages().catch(error => {
            console.error('Error processing scheduled messages:', error);
        });
    }, 60 * 1000);
    
    return interval;
}

/**
 * Admin command handler for scheduling a new message
 */
export const handleScheduleCommand = withErrorHandling(
    async (msg: TelegramBot.Message, args?: string[]): Promise<void> => {
        const chatId = msg.chat.id;
        
        // Check if this is an admin
        if (!process.env.ADMIN_IDS?.split(',').includes(chatId.toString())) {
            await bot.sendMessage(chatId, 'This command is available to admins only.');
            return;
        }
        
        // Command format: /schedule <time> <target> <message>
        // e.g., /schedule 2023-05-15T20:00:00 all Hello everyone!
        if (!args || args.length < 3) {
            await bot.sendMessage(
                chatId,
                'Usage: /schedule <time> <target> <message>\n\n' +
                'Time: ISO format (YYYY-MM-DDTHH:MM:SS) or relative (+30m, +2h, +1d)\n' +
                'Target: all, connected, active, or specific user IDs (comma-separated)\n' +
                'Message: The message text to send (supports Markdown)'
            );
            return;
        }
        
        // Parse scheduled time
        const timeArg = args[0];
        let scheduledTime: Date;
        
        if (timeArg.startsWith('+')) {
            // Relative time
            const now = new Date();
            const amount = parseInt(timeArg.substring(1, timeArg.length - 1));
            const unit = timeArg.charAt(timeArg.length - 1).toLowerCase();
            
            switch (unit) {
                case 'm': // minutes
                    scheduledTime = new Date(now.getTime() + amount * 60 * 1000);
                    break;
                case 'h': // hours
                    scheduledTime = new Date(now.getTime() + amount * 60 * 60 * 1000);
                    break;
                case 'd': // days
                    scheduledTime = new Date(now.getTime() + amount * 24 * 60 * 60 * 1000);
                    break;
                default:
                    await bot.sendMessage(chatId, 'Invalid time format. Use +30m, +2h, or +1d format.');
                    return;
            }
        } else {
            // Absolute time
            try {
                scheduledTime = new Date(timeArg);
                if (isNaN(scheduledTime.getTime())) {
                    throw new Error('Invalid date');
                }
            } catch (error) {
                await bot.sendMessage(chatId, 'Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS).');
                return;
            }
        }
        
        // Check if time is in the future
        if (scheduledTime.getTime() <= Date.now()) {
            await bot.sendMessage(chatId, 'Scheduled time must be in the future.');
            return;
        }
        
        // Parse target users
        const targetArg = args[1];
        let targetUsers: number[] | 'all' | 'connected' | 'active';
        
        if (['all', 'connected', 'active'].includes(targetArg)) {
            targetUsers = targetArg as 'all' | 'connected' | 'active';
        } else {
            // Parse as user IDs
            try {
                targetUsers = targetArg.split(',').map(id => parseInt(id.trim()));
                
                // Validate user IDs
                if (targetUsers.some(id => isNaN(id))) {
                    throw new Error('Invalid user ID');
                }
            } catch (error) {
                await bot.sendMessage(
                    chatId,
                    'Invalid target users format. Use "all", "connected", "active", or comma-separated user IDs.'
                );
                return;
            }
        }
        
        // Get message content (everything after target)
        const messageContent = args.slice(2).join(' ');
        
        if (!messageContent) {
            await bot.sendMessage(chatId, 'Message content cannot be empty.');
            return;
        }
        
        // Schedule the message
        const messageId = await scheduleMessage(
            messageContent,
            scheduledTime,
            targetUsers,
            chatId,
            'Markdown' // Default to Markdown formatting
        );
        
        // Format user-friendly target description
        let targetDescription: string;
        if (targetUsers === 'all') {
            targetDescription = 'all users';
        } else if (targetUsers === 'connected') {
            targetDescription = 'users with connected wallets';
        } else if (targetUsers === 'active') {
            targetDescription = 'active users (last 24h)';
        } else {
            targetDescription = `${targetUsers.length} specific users`;
        }
        
        // Send confirmation
        await bot.sendMessage(
            chatId,
            `\u2705 Message scheduled successfully!\n\n` +
            `ID: ${messageId}\n` +
            `Time: ${scheduledTime.toLocaleString()}\n` +
            `Target: ${targetDescription}\n` +
            `Message preview:\n----\n${messageContent.substring(0, 200)}${messageContent.length > 200 ? '...' : ''}`
        );
    },
    'schedule'
);

/**
 * Admin command handler for cancelling a scheduled message
 */
export const handleCancelScheduleCommand = withErrorHandling(
    async (msg: TelegramBot.Message, args?: string[]): Promise<void> => {
        const chatId = msg.chat.id;
        
        // Check if this is an admin
        if (!process.env.ADMIN_IDS?.split(',').includes(chatId.toString())) {
            await bot.sendMessage(chatId, 'This command is available to admins only.');
            return;
        }
        
        if (!args || args.length === 0) {
            await bot.sendMessage(chatId, 'Usage: /cancel_schedule <message_id>');
            return;
        }
        
        const messageId = args[0];
        
        // Cancel the message
        const success = await cancelScheduledMessage(messageId);
        
        if (success) {
            await bot.sendMessage(chatId, `\u2705 Scheduled message ${messageId} has been cancelled.`);
        } else {
            await bot.sendMessage(chatId, `\u274c Message with ID ${messageId} not found or already sent.`);
        }
    },
    'cancel_schedule'
);

/**
 * Admin command handler for listing scheduled messages
 */
export const handleListScheduledCommand = withErrorHandling(
    async (msg: TelegramBot.Message): Promise<void> => {
        const chatId = msg.chat.id;
        
        // Check if this is an admin
        if (!process.env.ADMIN_IDS?.split(',').includes(chatId.toString())) {
            await bot.sendMessage(chatId, 'This command is available to admins only.');
            return;
        }
        
        // Get all scheduled messages
        const messages = await getScheduledMessages();
        
        if (messages.length === 0) {
            await bot.sendMessage(chatId, 'No scheduled messages found.');
            return;
        }
        
        // Filter to pending messages only
        const pendingMessages = messages.filter(msg => msg.status === 'pending');
        
        if (pendingMessages.length === 0) {
            await bot.sendMessage(chatId, 'No pending scheduled messages found.');
            return;
        }
        
        // Format message list
        let response = `\ud83d\udcc5 *Scheduled Messages (${pendingMessages.length})*\n\n`;
        
        for (const message of pendingMessages) {
            const scheduledTime = new Date(message.scheduledTime).toLocaleString();
            
            // Format user-friendly target description
            let targetDescription: string;
            if (message.targetUsers === 'all') {
                targetDescription = 'all users';
            } else if (message.targetUsers === 'connected') {
                targetDescription = 'users with connected wallets';
            } else if (message.targetUsers === 'active') {
                targetDescription = 'active users (last 24h)';
            } else if (Array.isArray(message.targetUsers)) {
                targetDescription = `${message.targetUsers.length} specific users`;
            } else {
                targetDescription = 'unknown';
            }
            
            response += `\ud83c\udd94 *ID:* ${message.id}\n`;
            response += `\ud83d\udcc5 *Time:* ${scheduledTime}\n`;
            response += `\ud83d\udce2 *Target:* ${targetDescription}\n`;
            response += `\ud83d\udcac *Preview:* ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}\n\n`;
        }
        
        response += 'To cancel a message, use /cancel\_schedule <message\_id>';
        
        await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    },
    'list_scheduled'
);
