import { CommandRegistry } from '../src/commands/command-registry';
import { BaseCommand } from '../src/commands/base-command';
import TelegramBot from 'node-telegram-bot-api';

// Mock the bot to prevent actual API calls
jest.mock('../src/bot', () => ({
  bot: {
    sendMessage: jest.fn().mockResolvedValue({}),
    onText: jest.fn(),
  },
}));

// Test implementation of BaseCommand
class TestCommand extends BaseCommand {
  constructor(adminOnly: boolean = false) {
    super('test', adminOnly, 'Test command for unit tests');
  }
  
  protected async executeCommand(msg: TelegramBot.Message): Promise<void> {
    // Simple implementation for testing
    const bot = require('../src/bot').bot;
    await bot.sendMessage(msg.chat.id, 'Test command executed');
  }
}

describe('Command System', () => {
  describe('CommandRegistry', () => {
    it('should register and retrieve commands', () => {
      const registry = CommandRegistry.getInstance();
      
      // Clear any existing commands from previous tests
      (registry as any).commands = new Map();
      
      const testCommand = new TestCommand();
      registry.registerCommand(testCommand);
      
      expect(registry.getCommand('test')).toBe(testCommand);
      expect(registry.getAllCommands().length).toBe(1);
      expect(registry.getUserCommands().length).toBe(1);
      expect(registry.getAdminCommands().length).toBe(0);
    });
    
    it('should correctly categorize admin and user commands', () => {
      const registry = CommandRegistry.getInstance();
      
      // Clear any existing commands from previous tests
      (registry as any).commands = new Map();
      
      const userCommand = new TestCommand(false);
      const adminCommand = new TestCommand(true);
      
      registry.registerCommands([userCommand, adminCommand]);
      
      expect(registry.getAllCommands().length).toBe(2);
      expect(registry.getUserCommands().length).toBe(1);
      expect(registry.getAdminCommands().length).toBe(1);
      expect(registry.getUserCommands()[0].adminOnly).toBe(false);
      expect(registry.getAdminCommands()[0].adminOnly).toBe(true);
    });
  });
  
  describe('BaseCommand', () => {
    it('should execute command and handle user messages', async () => {
      const testCommand = new TestCommand();
      const mockMsg = {
        chat: { id: 123456 },
        from: { id: 654321 },
      };
      
      await testCommand.execute(mockMsg as any);
      
      const bot = require('../src/bot').bot;
      expect(bot.sendMessage).toHaveBeenCalledWith(123456, 'Test command executed');
    });
  });
});
