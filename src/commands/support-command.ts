import { BaseCommand } from './base-command';
import TelegramBot from 'node-telegram-bot-api';
import { bot } from '../bot';
import { isAdmin } from '../utils';
import { createClient } from 'redis';

// Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 10000,
    keepAlive: 10000
  }
});

redisClient.on('error', err => console.error('Redis Client Error in Support Command:', err));

// Connect to Redis if not already connected
async function getRedisClient() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  return redisClient;
}

// Redis keys for support system
const SUPPORT_THREAD_KEY = 'support:thread:';
const SUPPORT_PENDING_KEY = 'support:pending';

interface SupportMessage {
  userId: number;
  messageText: string | undefined;  // Allow undefined to fix TypeScript errors
  timestamp: number;
  userName?: string;
}

/**
 * Command for handling user support requests
 */
export class SupportCommand extends BaseCommand {
  constructor() {
    super('support', false, 'Contact support team or respond to support requests (admins only)');
  }

  protected async executeCommand(msg: TelegramBot.Message, _match?: RegExpExecArray | null): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const userName = msg.from?.username || msg.from?.first_name || 'Unknown User';
    
    if (!userId) {
      await bot.sendMessage(chatId, '❌ Error: Could not identify user.');
      return;
    }

    // Extract message content (everything after /support)
    const messageContent = msg.text?.substring('/support'.length).trim();

    if (isAdmin(userId)) {
      // Admin using support command
      await this.handleAdminSupport(chatId, userId, messageContent);
    } else {
      // Regular user using support command
      await this.handleUserSupport(chatId, userId, userName, messageContent);
    }
  }

  /**
   * Handle support requests from regular users
   */
  private async handleUserSupport(
    chatId: number,
    userId: number,
    userName: string,
    messageContent?: string
  ): Promise<void> {
    if (!messageContent) {
      await bot.sendMessage(
        chatId,
        '🔹 *Support System*\n\n' +
        'To contact our support team, send your message using:\n' +
        '`/support your message here`\n\n' +
        'Our team will respond as soon as possible.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Store the message in Redis
    const redis = await getRedisClient();
    const threadKey = `${SUPPORT_THREAD_KEY}${userId}`;
    const message: SupportMessage = {
      userId,
      messageText: messageContent,
      timestamp: Date.now(),
      userName
    };

    // Add to user's thread
    const messageJson = JSON.stringify(message);
    await redis.rPush(threadKey, messageJson);
    // Set TTL for thread (30 days)
    await redis.expire(threadKey, 30 * 24 * 60 * 60);
    
    // Add to pending list if not already there
    const isPending = await redis.sIsMember(SUPPORT_PENDING_KEY, userId.toString());
    if (!isPending) {
      await redis.sAdd(SUPPORT_PENDING_KEY, userId.toString());
    }

    // Notify all admins - ensure messageContent is definitely a string
    await this.notifyAdmins(userId, userName, messageContent as string);

    // Confirm receipt to user
    await bot.sendMessage(
      chatId,
      '✅ Your message has been sent to our support team. We will respond as soon as possible.'
    );
  }

  /**
   * Handle admin responses to support requests
   */
  private async handleAdminSupport(
    chatId: number,
    adminId: number,
    messageContent?: string
  ): Promise<void> {
    if (!messageContent) {
      // Show list of pending support requests
      await this.showPendingSupportRequests(chatId);
      return;
    }

    // Parse admin command format: /support <userId> <message>
    if (!messageContent) {
      await bot.sendMessage(
        chatId,
        '❌ Please provide a user ID and message. Format: /support <userId> <message>'
      );
      return;
    }
    
    // At this point, messageContent is guaranteed to be a string because of our earlier null check
    // Use type assertion to inform TypeScript this is definitely a string
    const parts = (messageContent as string).split(' ');
    // Ensure we have a valid string for parseInt to avoid TypeScript errors
    // Using a more explicit approach to handle the string for parseInt
    // Type assertion directly on the parts[0] element to force it to be string
    const firstPart = parts.length > 0 ? String(parts[0]) : '0';
    // Now we have a guaranteed string that can be passed to parseInt
    const targetUserId = parseInt(firstPart);
    
    if (isNaN(targetUserId)) {
      await bot.sendMessage(
        chatId,
        '❌ Invalid format. Use `/support <userId> <message>` to respond to a user.'
      );
      return;
    }

    // Get the response message (everything after the user ID)
    let responseMessage = '';
    if (parts.length > 1) {
      responseMessage = parts.slice(1).join(' ').trim();
    }
    if (!responseMessage) {
      await bot.sendMessage(
        chatId,
        '❌ Please include a message to send to the user.'
      );
      return;
    }

    // Store admin response in thread
    const redis = await getRedisClient();
    const threadKey = `${SUPPORT_THREAD_KEY}${targetUserId}`;
    
    // Ensure we have valid strings for all fields to avoid TypeScript errors
    const message: SupportMessage = {
      userId: adminId,
      messageText: responseMessage || '',  // Ensure string type with default empty string
      timestamp: Date.now()
    };

    // Add to thread
    const messageJson = JSON.stringify(message);
    await redis.rPush(threadKey, messageJson);
    
    // Send response to user
    try {
      await bot.sendMessage(
        targetUserId,
        `🔹 *Support Response:*\n\n${responseMessage}\n\nReply with \`/support your reply\` to continue this conversation.`,
        { parse_mode: 'Markdown' }
      );
      
      // Confirm to admin
      await bot.sendMessage(
        chatId,
        `✅ Message sent to user ${targetUserId}.`
      );
    } catch (error) {
      console.error('Failed to send support response:', error);
      await bot.sendMessage(
        chatId,
        `❌ Failed to send message to user ${targetUserId}. They may have blocked the bot.`
      );
    }
  }

  /**
   * Show list of pending support requests to admin
   */
  private async showPendingSupportRequests(chatId: number): Promise<void> {
    const redis = await getRedisClient();
    const pendingUserIds = await redis.sMembers(SUPPORT_PENDING_KEY);

    if (!pendingUserIds.length) {
      await bot.sendMessage(
        chatId,
        '✅ No pending support requests.'
      );
      return;
    }

    let message = '🔸 *Pending Support Requests:*\n\n';
    
    for (const userIdStr of pendingUserIds) {
      const userId = parseInt(userIdStr);
      const threadKey = `${SUPPORT_THREAD_KEY}${userId}`;
      
      // Get latest message from thread
      const threadLength = await redis.lLen(threadKey);
      if (threadLength > 0) {
        const latestMsg = await redis.lIndex(threadKey, -1);
        if (latestMsg && typeof latestMsg === 'string') {
          try {
            const msgObj = JSON.parse(latestMsg) as SupportMessage;
            const date = new Date(msgObj.timestamp).toLocaleString();
            const userName = msgObj.userName || 'User';
            // Handle possibly undefined messageText
            const messageText = msgObj.messageText || '';
            const previewText = messageText.length > 50 
              ? messageText.substring(0, 50) + '...' 
              : messageText;
            
            message += `👤 *${userName}* (ID: ${userId})\n`;
            message += `📝 "${previewText}"\n`;
            message += `🕒 ${date}\n`;
            message += `Reply: \`/support ${userId} your response\`\n\n`;
          } catch (e) {
            message += `👤 User ${userId}\n`;
            message += `Error parsing message data\n\n`;
          }
        }
      } else {
        message += `👤 User ${userId}\n`;
        message += `No message content available\n\n`;
      }
    }

    message += 'To respond to a user, use:\n`/support <userId> <your message>`';
    
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  /**
   * Notify all admins about a new support request
   */
  private async notifyAdmins(userId: number, userName: string, messageContent: string | undefined): Promise<void> {
    // Get admin IDs from environment variable
    const adminIdsEnv = process.env.ADMIN_IDS || '';
    const adminIds = adminIdsEnv.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    
    if (!adminIds.length) {
      console.warn('No admin IDs configured for support notifications');
      return;
    }
    
    // Handle potentially undefined messageContent
    const safeMessageContent = messageContent || '(No message provided)';
    
    const notification = 
      `🔔 *New Support Request*\n\n` +
      `From: ${userName} (ID: ${userId})\n` +
      `Message: ${safeMessageContent}\n\n` +
      `Reply with: \`/support ${userId} your response\``;
    
    for (const adminId of adminIds) {
      try {
        await bot.sendMessage(adminId, notification, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error(`Failed to notify admin ${adminId}:`, error);
      }
    }
  }
}
