"use strict";
// This file is kept for backward compatibility but is no longer used.
// The bot instances are now created and managed by the BotFactory in bot-factory.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
const bot_factory_1 = require("./bot-factory");
// Create a dummy bot for backward compatibility
// This will use the first bot from the factory or a dummy implementation
let dummyBot;
// Try to get the first bot from the factory
try {
    const botFactory = bot_factory_1.BotFactory.getInstance();
    const bots = botFactory.getAllBots();
    if (bots.size > 0) {
        // Get the first bot from the map
        const firstBot = bots.values().next().value;
        dummyBot = firstBot; // Ensure type safety
    }
    else {
        // Create a dummy implementation that logs warnings
        dummyBot = new Proxy({}, {
            get: function (_target, prop) {
                // Return a function that logs a warning
                return function (_) {
                    console.warn(`Warning: Using deprecated bot.${String(prop)}() - Update to use BotFactory`);
                    return Promise.resolve();
                };
            }
        });
    }
}
catch (error) {
    console.error('Error creating dummy bot:', error);
    // Create a dummy implementation
    dummyBot = new Proxy({}, {
        get: function (_target, prop) {
            return function (_) {
                console.error(`Error: Using deprecated bot.${String(prop)}() - BotFactory failed to initialize`);
                return Promise.resolve();
            };
        }
    });
}
// Export the dummy bot for backward compatibility
exports.bot = dummyBot;
//# sourceMappingURL=bot.js.map