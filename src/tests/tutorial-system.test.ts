import { handleTutorialCommand, handleSkipCommand, handleTutorialCallback } from '../tutorial-system';
import { mockBot, mockRedisClient, resetMocks, createMockMessage, createMockCallbackQuery } from './test-setup';
import { getTutorialState, saveTutorialState } from '../ton-connect/storage';

// Mock the storage functions
jest.mock('../ton-connect/storage', () => ({
    getTutorialState: jest.fn(),
    saveTutorialState: jest.fn()
}));

describe('Tutorial System', () => {
    beforeEach(() => {
        resetMocks();
    });
    
    test('handleTutorialCommand should start a tutorial for new users', async () => {
        // Mock getTutorialState to return null (user has no tutorial state)
        (getTutorialState as jest.Mock).mockResolvedValue(null);
        
        // Create a mock message
        const mockMessage = createMockMessage(123456789, '/tutorial');
        
        // Execute the command
        await handleTutorialCommand(mockMessage);
        
        // Verify tutorial state was saved
        expect(saveTutorialState).toHaveBeenCalledWith({
            userId: mockMessage.chat.id,
            currentStep: 0,
            completed: false,
            startedAt: expect.any(Number),
            lastUpdatedAt: expect.any(Number),
            skipped: false
        });
        
        // Verify a message was sent to the user
        expect(mockBot.sendMessage).toHaveBeenCalledWith(
            mockMessage.chat.id,
            expect.any(String),
            expect.objectContaining({
                parse_mode: 'Markdown',
                reply_markup: expect.objectContaining({
                    inline_keyboard: expect.any(Array)
                })
            })
        );
    });
    
    test('handleSkipCommand should mark tutorial as skipped', async () => {
        // Mock an active tutorial
        const mockTutorialState = {
            userId: 123456789,
            currentStep: 2,
            completed: false,
            startedAt: Date.now() - 1000 * 60, // Started 1 minute ago
            lastUpdatedAt: Date.now() - 1000 * 30, // Last updated 30 seconds ago
            skipped: false
        };
        
        (getTutorialState as jest.Mock).mockResolvedValue(mockTutorialState);
        
        // Create a mock message
        const mockMessage = createMockMessage(123456789, '/skip');
        
        // Execute the command
        await handleSkipCommand(mockMessage);
        
        // Verify tutorial state was updated
        expect(saveTutorialState).toHaveBeenCalledWith({
            ...mockTutorialState,
            skipped: true
        });
        
        // Verify a message was sent to the user
        expect(mockBot.sendMessage).toHaveBeenCalledWith(
            mockMessage.chat.id,
            'Tutorial skipped. You can restart it anytime with /tutorial.'
        );
    });
    
    test('handleTutorialCallback should navigate to next step', async () => {
        // Mock tutorial state
        const mockTutorialState = {
            userId: 123456789,
            currentStep: 1,
            completed: false,
            startedAt: Date.now() - 1000 * 60,
            lastUpdatedAt: Date.now() - 1000 * 30,
            skipped: false
        };
        
        (getTutorialState as jest.Mock).mockResolvedValue(mockTutorialState);
        
        // Create mock callback query
        const mockQuery = createMockCallbackQuery(
            123456789,
            JSON.stringify({ method: 'tutorial_next', data: '' })
        );
        
        // Execute callback
        await handleTutorialCallback(mockQuery, 'tutorial_next');
        
        // Verify tutorial state was updated
        expect(saveTutorialState).toHaveBeenCalledWith({
            ...mockTutorialState,
            currentStep: 2,
            lastUpdatedAt: expect.any(Number)
        });
        
        // Verify old message was deleted
        expect(mockBot.deleteMessage).toHaveBeenCalledWith(
            mockQuery.from.id,
            mockQuery.message?.message_id
        );
        
        // Verify new tutorial step was shown
        expect(mockBot.sendMessage).toHaveBeenCalled();
    });
});
