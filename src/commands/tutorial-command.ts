import TelegramBot from 'node-telegram-bot-api';
import { BaseCommand } from './base-command';
import { bot } from '../bot';
import { getTutorialState, startTutorial, skipTutorial } from '../tutorial-system';
import { ErrorHandler, ErrorType } from '../error-handler';

/**
 * Command to start the interactive tutorial
 */
export class TutorialCommand extends BaseCommand {
    constructor() {
        super('tutorial', 'Start the interactive bot tutorial');
    }
    
    async execute(msg: TelegramBot.Message, _args?: string[]): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            // Get current tutorial state
            const tutorialState = await getTutorialState(chatId);
            
            if (tutorialState && tutorialState.completed) {
                // User already completed tutorial
                await bot.sendMessage(
                    chatId,
                    'You have already completed the tutorial. If you want to go through it again, please contact support.'
                );
                return;
            }
            
            await startTutorial(chatId);
        } catch (error) {
            if (error instanceof Error) {
                await ErrorHandler.handleError(error, ErrorType.COMMAND_HANDLER, {
                    commandName: 'tutorial',
                    userId: chatId,
                    message: msg.text || ''
                });
            }
            
            // Send a generic error message
            await bot.sendMessage(
                chatId,
                '❌ Error starting tutorial. Please try again later.'
            );
        }
    }
}

/**
 * Command to skip the tutorial
 */
export class SkipTutorialCommand extends BaseCommand {
    constructor() {
        super('skip', 'Skip the interactive tutorial');
    }
    
    async execute(msg: TelegramBot.Message, _args?: string[]): Promise<void> {
        const chatId = msg.chat.id;
        
        try {
            const tutorialState = await getTutorialState(chatId);
            
            if (!tutorialState || tutorialState.completed) {
                await bot.sendMessage(chatId, 'No tutorial in progress to skip.');
                return;
            }
            
            await skipTutorial(chatId);
            
            await bot.sendMessage(
                chatId,
                '✅ Tutorial skipped. You can start it again anytime with /tutorial.'
            );
        } catch (error) {
            if (error instanceof Error) {
                await ErrorHandler.handleError(error, ErrorType.COMMAND_HANDLER, {
                    commandName: 'skip',
                    userId: chatId,
                    message: msg.text || ''
                });
            }
            
            await bot.sendMessage(
                chatId,
                '❌ Error skipping tutorial. Please try again later.'
            );
        }
    }
}
