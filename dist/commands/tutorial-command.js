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
const tutorial_manager_1 = require("../tutorial/tutorial-manager");
const error_handler_1 = require("../error-handler");
/**
 * Command to start or resume the interactive tutorial
 */
class TutorialCommand extends base_command_1.BaseCommand {
    constructor() {
        super('tutorial', // command name
        false, // not admin-only
        'Start or resume the interactive tutorial' // description
        );
        this.tutorialManager = tutorial_manager_1.TutorialManager.getInstance();
    }
    /**
     * Execute the tutorial command
     */
    executeCommand(msg) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.tutorialManager.startTutorial(msg);
            }
            catch (error) {
                error_handler_1.ErrorHandler.handleError({
                    type: error_handler_1.ErrorType.COMMAND_HANDLER,
                    message: `Error starting tutorial: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`,
                    command: this.name,
                    userId: (_a = msg.from) === null || _a === void 0 ? void 0 : _a.id,
                    timestamp: Date.now(),
                    stack: error === null || error === void 0 ? void 0 : error.stack
                });
                throw error; // Re-throw to let the base command error handler manage the user message
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
        super('skip_tutorial', // command name
        false, // not admin-only
        'Skip the interactive tutorial' // description
        );
        this.tutorialManager = tutorial_manager_1.TutorialManager.getInstance();
    }
    /**
     * Execute the skip tutorial command
     */
    executeCommand(msg) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.tutorialManager.skipTutorial(msg);
            }
            catch (error) {
                error_handler_1.ErrorHandler.handleError({
                    type: error_handler_1.ErrorType.COMMAND_HANDLER,
                    message: `Error skipping tutorial: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`,
                    command: this.name,
                    userId: (_a = msg.from) === null || _a === void 0 ? void 0 : _a.id,
                    timestamp: Date.now(),
                    stack: error === null || error === void 0 ? void 0 : error.stack
                });
                throw error; // Re-throw to let the base command error handler manage the user message
            }
        });
    }
}
exports.SkipTutorialCommand = SkipTutorialCommand;
//# sourceMappingURL=tutorial-command.js.map