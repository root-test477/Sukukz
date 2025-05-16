import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand } from './base-command';
/**
 * Command to view and manage errors (admin only)
 */
export declare class ErrorsCommand extends BaseCommand {
    constructor();
    /**
     * Execute the errors command
     */
    protected executeCommand(msg: TelegramBot.Message, match?: RegExpExecArray | null): Promise<void>;
    /**
     * Override to get a custom regex pattern that includes an optional limit parameter
     */
    getRegexPattern(): RegExp;
}
/**
 * Command to view analytics (admin only)
 */
export declare class AnalyticsCommand extends BaseCommand {
    constructor();
    /**
     * Execute the analytics command
     */
    protected executeCommand(msg: TelegramBot.Message): Promise<void>;
}
/**
 * Command to schedule a message to all users or a specific segment
 */
export declare class ScheduleMessageCommand extends BaseCommand {
    constructor();
    /**
     * Custom regex to handle the schedule command format
     * /schedule <time> <segment> <message>
     */
    getRegexPattern(): RegExp;
    /**
     * Execute the schedule message command
     */
    protected executeCommand(msg: TelegramBot.Message, match?: RegExpExecArray | null): Promise<void>;
}
