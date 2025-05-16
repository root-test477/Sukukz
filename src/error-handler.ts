import TelegramBot from 'node-telegram-bot-api';
import { bot } from './bot';
import { RedisClientType } from 'redis';
import { getRedisClient, saveErrorReport } from './ton-connect/storage';

interface ErrorReport {
    id: string;
    timestamp: string;
    commandName: string;
    userId: number;
    userMessage: string;
    error: string;
    stack?: string;
}

/**
 * Global error handler for command execution
 * Wraps command handlers to prevent crashes and log errors
 */
export function withErrorHandling(
    handler: (msg: TelegramBot.Message, ...args: any[]) => Promise<void>,
    commandName: string
) {
    return async (msg: TelegramBot.Message, ...args: any[]): Promise<void> => {
        try {
            await handler(msg, ...args);
        } catch (error: any) {
            const chatId = msg.chat.id;
            const errorId = generateErrorId();
            console.error(`Error in ${commandName} [ErrorID: ${errorId}]:`, error);
            
            // Create error report
            const errorReport: ErrorReport = {
                id: errorId,
                timestamp: new Date().toISOString(),
                commandName,
                userId: chatId,
                userMessage: msg.text || '',
                error: error.message || 'Unknown error',
                stack: error.stack
            };
            
            // Save error report
            try {
                await saveErrorReport(errorReport);
            } catch (storageError) {
                console.error('Failed to save error report:', storageError);
            }
            
            // Send user-friendly error message
            await bot.sendMessage(
                chatId,
                `⚠️ Something went wrong while processing your request.
                
Error ID: ${errorId}
                
Our team has been notified. If this issue persists, please contact support with this Error ID.`
            );
        }
    };
}

/**
 * Handle uncaught exceptions and unhandled rejections at process level
 */
export function setupGlobalErrorHandlers() {
    process.on('uncaughtException', (error) => {
        console.error('UNCAUGHT EXCEPTION:', error);
        // Log to a monitoring service or file if needed
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('UNHANDLED REJECTION:', reason);
        // Log to a monitoring service or file if needed
    });
}

/**
 * Generate a unique error ID for tracking
 */
function generateErrorId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Handler for the /errors command (admin-only)
 * Retrieves recent error reports
 */
export async function handleErrorsCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    // Safely extract limit parameter with a default value
    const limitStr = msg.text?.split(' ')[1] || '10';
    const limit = parseInt(limitStr, 10);
    
    try {
        const redisClient = await getRedisClient();
        // Get error IDs from Redis, sorted by time (newest first)
        const errorIds = await redisClient.zRange('error_reports', 0, -1, { REV: true }) as string[];
        
        if (!errorIds || errorIds.length === 0) {
            await bot.sendMessage(chatId, '📊 No errors have been reported.');
            return;
        }
        
        // Get the most recent error reports
        const recentErrorIds = errorIds.slice(0, limit);
        const errorReports: ErrorReport[] = [];
        
        for (const errorId of recentErrorIds) {
            const errorData = await redisClient.hGetAll(`error:${errorId}`);
            if (Object.keys(errorData).length > 0) {
                errorReports.push({
                    id: errorId,
                    timestamp: errorData.timestamp || '',
                    commandName: errorData.commandName || '',
                    userId: parseInt(errorData.userId) || 0,
                    userMessage: errorData.userMessage || '',
                    error: errorData.error || '',
                    stack: errorData.stack
                });
            }
        }
        
        // Format and send report
        let responseText = `📊 *Recent Error Reports* (Last ${Math.min(limit, errorReports.length)})

`;
        
        for (const report of errorReports) {
            const date = new Date(report.timestamp);
            const formattedDate = date.toLocaleString();
            
            responseText += `🆔 *Error ID:* ${report.id}\n`;
            responseText += `⏰ *Time:* ${formattedDate}\n`;
            responseText += `🤖 *Command:* ${report.commandName}\n`;
            responseText += `👤 *User ID:* ${report.userId}\n`;
            responseText += `💬 *User Input:* ${report.userMessage || 'N/A'}\n`;
            responseText += `❌ *Error:* ${report.error}\n\n`;
        }
        
        await bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('Error fetching error reports:', error);
        await bot.sendMessage(chatId, 'Failed to retrieve error reports.');
    }
}
