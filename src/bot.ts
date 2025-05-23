// This file is kept for backward compatibility but is no longer used.
// The bot instances are now created and managed by the BotFactory in bot-factory.ts

import TelegramBot from 'node-telegram-bot-api';
import { BotFactory } from './bot-factory';

// Create a dummy bot for backward compatibility
// This will use the first bot from the factory or a dummy implementation
let dummyBot: TelegramBot;

// Try to get the first bot from the factory
try {
    const botFactory = BotFactory.getInstance();
    const bots = botFactory.getAllBots();
    if (bots.size > 0) {
        // Get the first bot from the map
        const firstBot = bots.values().next().value;
        dummyBot = firstBot as TelegramBot; // Ensure type safety
    } else {
        // Create a dummy implementation that logs warnings
        dummyBot = new Proxy({} as TelegramBot, {
            get: function(_target, prop) {
                // Return a function that logs a warning
                return function(_: any) {
                    console.warn(`Warning: Using deprecated bot.${String(prop)}() - Update to use BotFactory`);
                    return Promise.resolve();
                };
            }
        });
    }
} catch (error) {
    console.error('Error creating dummy bot:', error);
    // Create a dummy implementation
    dummyBot = new Proxy({} as TelegramBot, {
        get: function(_target, prop) {
            return function(_: any) {
                console.error(`Error: Using deprecated bot.${String(prop)}() - BotFactory failed to initialize`);
                return Promise.resolve();
            };
        }
    });
}

// Export the dummy bot for backward compatibility
export const bot = dummyBot;
export type TelegramBotType = TelegramBot;
