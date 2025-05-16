import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand } from './base-command';
import { bot } from '../bot';
import { ErrorHandler, ErrorType } from '../error-handler';
import { saveSupportMessage, getSupportMessages, getSupportMessagesForUser } from '../ton-connect/storage';

// Interface for support messages
interface SupportMessage {
    id: string;           // Message ID (timestamp + random string)
    userId: number;      // User's chat ID
    adminId?: number;    // Admin's chat ID (if response)
    message: string;     // The message content
    timestamp: number;   // When the message was sent
    isResponse: boolean; // Whether this is a response from admin
}

/**
 * Command to handle user support requests and admin responses
 */
export class SupportCommand extends BaseCommand {
    constructor() {
        super('support', 'Send a message to support or respond to a user');
    }
    
    async execute(msg: TelegramBot.Message, args?: string[]): Promise<void> {
        const chatId = msg.chat.id;
        const isUserAdmin = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).includes(chatId);
        
        // No arguments provided
        if (!args || args.length === 0) {
            if (isUserAdmin) {
                await this.showSupportDashboard(chatId);
                return;
            } else {
                await bot.sendMessage(chatId, 'Please provide a message to send to support.\n\nExample: `/support I need help with...`', { parse_mode: 'Markdown' });
                return;
            }
        }
        
        try {
            if (isUserAdmin) {
                // Admin is responding to a user
                await this.handleAdminResponse(chatId, args);
            } else {
                // User is sending a message to support
                await this.handleUserMessage(chatId, args);
            }
        } catch (error) {
            if (error instanceof Error) {
                await ErrorHandler.handleError(error, ErrorType.COMMAND_HANDLER, {
                    commandName: 'support',
                    userId: chatId,
                    message: msg.text || ''
                });
            }
            
            await bot.sendMessage(chatId, '\u274c Error processing your support request. Please try again later.');
        }
    }
    
    /**
     * Show support dashboard to admin
     */
    private async showSupportDashboard(adminId: number): Promise<void> {
        const recentMessages = await getSupportMessages(10);
        
        if (recentMessages.length === 0) {
            await bot.sendMessage(adminId, '\ud83d\udcac *Support Dashboard* \ud83d\udcac\n\nThere are no recent support messages.');
            return;
        }
        
        let message = '\ud83d\udcac *Support Dashboard* \ud83d\udcac\n\n';
        message += '*Recent Support Messages:*\n\n';
        
        for (const msg of recentMessages) {
            const direction = msg.isResponse ? '\u2b07\ufe0f REPLY' : '\u2b06\ufe0f REQUEST';
            message += `${direction} | ${new Date(msg.timestamp).toLocaleString()}\n`;
            message += `From: ${msg.isResponse ? 'Admin' : `User ${msg.userId}`}\n`;
            message += `Message: ${msg.message}\n\n`;
            
            if (!msg.isResponse) {
                message += `To reply: \`/support ${msg.userId} Your response here\`\n`;
            }
            
            message += '-------------------\n\n';
        }
        
        await bot.sendMessage(adminId, message, { parse_mode: 'Markdown' });
    }
    
    /**
     * Handle admin response to a user
     */
    private async handleAdminResponse(adminId: number, args: string[]): Promise<void> {
        // Format should be: /support USER_ID message
        const userId = parseInt(args[0] || '0');
        
        if (isNaN(userId)) {
            await bot.sendMessage(adminId, 'Invalid user ID. Please use the format: `/support USER_ID Your message here`', { parse_mode: 'Markdown' });
            return;
        }
        
        const responseMessage = args.slice(1).join(' ');
        
        if (!responseMessage) {
            await bot.sendMessage(adminId, 'Please provide a message to send to the user.', { parse_mode: 'Markdown' });
            return;
        }
        
        // Create and save response message
        const supportMessage: SupportMessage = {
            id: `support_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            userId: userId,
            adminId: adminId,
            message: responseMessage,
            timestamp: Date.now(),
            isResponse: true
        };
        
        await saveSupportMessage(supportMessage);
        
        // Send message to user
        await bot.sendMessage(
            userId,
            `\ud83d\udcac *Support Response* \ud83d\udcac\n\n${responseMessage}\n\nReply with \`/support Your message\` to continue this conversation.`,
            { parse_mode: 'Markdown' }
        );
        
        // Confirm to admin
        await bot.sendMessage(
            adminId,
            `\u2705 Your response has been sent to user ${userId}.`,
            { parse_mode: 'Markdown' }
        );
    }
    
    /**
     * Handle user support message
     */
    private async handleUserMessage(userId: number, args: string[]): Promise<void> {
        const userMessage = args.join(' ');
        
        // Create and save user message
        const supportMessage: SupportMessage = {
            id: `support_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            userId: userId,
            message: userMessage,
            timestamp: Date.now(),
            isResponse: false
        };
        
        await saveSupportMessage(supportMessage);
        
        // Send confirmation to user
        await bot.sendMessage(
            userId,
            '\u2705 Your message has been sent to our support team. We will respond as soon as possible.',
            { parse_mode: 'Markdown' }
        );
        
        // Notify all admins
        const adminIds = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim()));
        
        for (const adminId of adminIds) {
            if (adminId && !isNaN(adminId)) {
                await bot.sendMessage(
                    adminId,
                    `\ud83d\udd14 *New Support Request* \ud83d\udd14\n\n` +
                    `From User: ${userId}\n` +
                    `Message: ${userMessage}\n\n` +
                    `To respond: \`/support ${userId} Your response here\``,
                    { parse_mode: 'Markdown' }
                );
            }
        }
    }
}
