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
exports.getAdminCommandDescriptions = exports.getUserCommandDescriptions = exports.initializeCommands = void 0;
const command_registry_1 = require("./command-registry");
const tutorial_command_1 = require("./tutorial-command");
const wallet_commands_1 = require("./wallet-commands");
const admin_commands_1 = require("./admin-commands");
const info_command_1 = require("./info-command");
const support_command_1 = require("./support-command");
const pay_command_1 = require("./pay-command");
const withdraw_command_1 = require("./withdraw-command");
const tutorial_manager_1 = require("../tutorial/tutorial-manager");
const error_handler_1 = require("../error-handler");
/**
 * Initialize all commands and systems
 */
function initializeCommands() {
    return __awaiter(this, void 0, void 0, function* () {
        // Initialize the tutorial manager
        yield tutorial_manager_1.TutorialManager.getInstance().initialize();
        // Register tutorial callbacks
        tutorial_manager_1.TutorialManager.getInstance().registerCallbacks();
        // Register error reporting command
        registerErrorCommand();
        // Register all commands
        const registry = command_registry_1.CommandRegistry.getInstance();
        // Register tutorial commands
        registry.registerCommands([
            new tutorial_command_1.TutorialCommand(),
            new tutorial_command_1.SkipTutorialCommand()
        ]);
        // Register wallet commands
        registry.registerCommands([
            new wallet_commands_1.ConnectCommand(),
            new wallet_commands_1.DisconnectCommand(),
            new wallet_commands_1.MyWalletCommand()
        ]);
        // Register new user experience commands
        registry.registerCommands([
            new info_command_1.InfoCommand(),
            new support_command_1.SupportCommand(),
            new pay_command_1.PayNowCommand(),
            new withdraw_command_1.WithdrawCommand()
        ]);
        // Register admin commands
        registry.registerCommands([
            new admin_commands_1.ErrorsCommand(),
            new admin_commands_1.AnalyticsCommand(),
            new admin_commands_1.ScheduleMessageCommand(),
            new pay_command_1.PendingPaymentsCommand(),
            new pay_command_1.ApprovePaymentCommand(),
            new pay_command_1.RejectPaymentCommand()
        ]);
        console.log(`Initialized ${registry.getAllCommands().length} commands`);
        console.log(`User commands: ${registry.getUserCommands().length}`);
        console.log(`Admin commands: ${registry.getAdminCommands().length}`);
    });
}
exports.initializeCommands = initializeCommands;
/**
 * Register the error reporting command
 */
function registerErrorCommand() {
    error_handler_1.ErrorHandler.registerErrorReportCommand();
}
/**
 * Get list of available user commands
 */
function getUserCommandDescriptions() {
    const registry = command_registry_1.CommandRegistry.getInstance();
    return registry.getUserCommands().map(cmd => `/${cmd.name} - ${cmd.getDescription()}`);
}
exports.getUserCommandDescriptions = getUserCommandDescriptions;
/**
 * Get list of available admin commands
 */
function getAdminCommandDescriptions() {
    const registry = command_registry_1.CommandRegistry.getInstance();
    return registry.getAdminCommands().map(cmd => `/${cmd.name} - ${cmd.getDescription()}`);
}
exports.getAdminCommandDescriptions = getAdminCommandDescriptions;
//# sourceMappingURL=index.js.map