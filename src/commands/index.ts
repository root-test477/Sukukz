import { CommandRegistry } from './command-registry';
import { TutorialCommand, SkipTutorialCommand } from './tutorial-command';
import { ConnectCommand, DisconnectCommand, MyWalletCommand } from './wallet-commands';
import { ErrorsCommand, AnalyticsCommand, ScheduleMessageCommand } from './admin-commands';
import { InfoCommand } from './info-command';
import { SupportCommand } from './support-command';
import { PayNowCommand, PendingPaymentsCommand, ApprovePaymentCommand, RejectPaymentCommand } from './pay-command';
import { WithdrawCommand } from './withdraw-command';
import { TutorialManager } from '../tutorial/tutorial-manager';
import { ErrorHandler } from '../error-handler';
import { WalletCache } from '../caching/wallet-cache';

/**
 * Initialize all commands and systems
 */
export async function initializeCommands(): Promise<void> {
    // Initialize the tutorial manager
    await TutorialManager.getInstance().initialize();
    
    // Register tutorial callbacks
    TutorialManager.getInstance().registerCallbacks();
    
    // Register error reporting command
    registerErrorCommand();
    
    // Register all commands
    const registry = CommandRegistry.getInstance();
    
    // Register tutorial commands
    registry.registerCommands([
        new TutorialCommand(),
        new SkipTutorialCommand()
    ]);
    
    // Register wallet commands
    registry.registerCommands([
        new ConnectCommand(),
        new DisconnectCommand(),
        new MyWalletCommand()
    ]);
    
    // Register new user experience commands
    registry.registerCommands([
        new InfoCommand(),
        new SupportCommand(),
        new PayNowCommand(),
        new WithdrawCommand()
    ]);
    
    // Register admin commands
    registry.registerCommands([
        new ErrorsCommand(),
        new AnalyticsCommand(),
        new ScheduleMessageCommand(),
        new PendingPaymentsCommand(),
        new ApprovePaymentCommand(),
        new RejectPaymentCommand()
    ]);
    
    console.log(`Initialized ${registry.getAllCommands().length} commands`);
    console.log(`User commands: ${registry.getUserCommands().length}`);
    console.log(`Admin commands: ${registry.getAdminCommands().length}`);
}

/**
 * Register the error reporting command
 */
function registerErrorCommand(): void {
    ErrorHandler.registerErrorReportCommand();
}

/**
 * Get list of available user commands
 */
export function getUserCommandDescriptions(): string[] {
    const registry = CommandRegistry.getInstance();
    return registry.getUserCommands().map(cmd => `/${cmd.name} - ${cmd.getDescription()}`);
}

/**
 * Get list of available admin commands
 */
export function getAdminCommandDescriptions(): string[] {
    const registry = CommandRegistry.getInstance();
    return registry.getAdminCommands().map(cmd => `/${cmd.name} - ${cmd.getDescription()}`);
}
