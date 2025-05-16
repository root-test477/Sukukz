/// <reference types="node" />
import TelegramBot from 'node-telegram-bot-api';
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
export declare function scheduleMessage(content: string, scheduledTime: Date, targetUsers: number[] | 'all' | 'connected' | 'active', createdBy: number, parseMode?: 'Markdown' | 'HTML'): Promise<string>;
/**
 * Cancel a scheduled message
 */
export declare function cancelScheduledMessage(id: string): Promise<boolean>;
/**
 * Get all scheduled messages
 */
export declare function getScheduledMessages(): Promise<ScheduledMessage[]>;
/**
 * Check for and send any due scheduled messages
 */
export declare function processScheduledMessages(): Promise<void>;
/**
 * Set up periodic checking of scheduled messages
 * Call this during application initialization
 */
export declare function setupScheduledMessagesProcessor(): NodeJS.Timeout;
/**
 * Admin command handler for scheduling a new message
 */
export declare const handleScheduleCommand: (msg: TelegramBot.Message, ...args: any[]) => Promise<void>;
/**
 * Admin command handler for cancelling a scheduled message
 */
export declare const handleCancelScheduleCommand: (msg: TelegramBot.Message, ...args: any[]) => Promise<void>;
/**
 * Admin command handler for listing scheduled messages
 */
export declare const handleListScheduledCommand: (msg: TelegramBot.Message, ...args: any[]) => Promise<void>;
export {};
