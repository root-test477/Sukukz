"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkipTutorialCommand = exports.TutorialCommand = void 0;
const base_command_1 = require("./base-command");
const bot_1 = require("../bot");
const tutorial_system_1 = require("../tutorial-system");
const error_handler_1 = require("../error-handler");
/**
 * Command to start the interactive tutorial
 */
class TutorialCommand extends base_command_1.BaseCommand {
    constructor() {
        super('tutorial', 'Start the interactive bot tutorial');
    }
    execute(msg, _args) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            try {
                // Get current tutorial state
                const tutorialState = yield (0, tutorial_system_1.getTutorialState)(chatId);
                if (tutorialState && tutorialState.completed) {
                    // User already completed tutorial
                    yield bot_1.bot.sendMessage(chatId, 'You have already completed the tutorial. If you want to go through it again, please contact support.');
                    return;
                }
                yield (0, tutorial_system_1.startTutorial)(chatId);
            }
            catch (error) {
                if (error instanceof Error) {
                    yield error_handler_1.ErrorHandler.handleError(error, error_handler_1.ErrorType.COMMAND_HANDLER, {
                        commandName: 'tutorial',
                        userId: chatId,
                        message: msg.text || ''
                    });
                }
                // Send a generic error message
                yield bot_1.bot.sendMessage(chatId, '❌ Error starting tutorial. Please try again later.');
            }
        });
    }
}
exports.TutorialCommand = TutorialCommand;
/**
 * Command to skip the tutorial
 */
class SkipTutorialCommand extends base_command_1.BaseCommand {
    constructor() {
        super('skip', 'Skip the interactive tutorial');
    }
    execute(msg, _args) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            try {
                const tutorialState = yield (0, tutorial_system_1.getTutorialState)(chatId);
                if (!tutorialState || tutorialState.completed) {
                    yield bot_1.bot.sendMessage(chatId, 'No tutorial in progress to skip.');
                    return;
                }
                yield (0, tutorial_system_1.skipTutorial)(chatId);
                yield bot_1.bot.sendMessage(chatId, '✅ Tutorial skipped. You can start it again anytime with /tutorial.');
            }
            catch (error) {
                if (error instanceof Error) {
                    yield error_handler_1.ErrorHandler.handleError(error, error_handler_1.ErrorType.COMMAND_HANDLER, {
                        commandName: 'skip',
                        userId: chatId,
                        message: msg.text || ''
                    });
                }
                yield bot_1.bot.sendMessage(chatId, '❌ Error skipping tutorial. Please try again later.');
            }
        });
    }
}
exports.SkipTutorialCommand = SkipTutorialCommand;
//# sourceMappingURL=tutorial-command.js.map