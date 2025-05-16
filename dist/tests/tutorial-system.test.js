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
const tutorial_system_1 = require("../tutorial-system");
const test_setup_1 = require("./test-setup");
const storage_1 = require("../ton-connect/storage");
// Mock the storage functions
jest.mock('../ton-connect/storage', () => ({
    getTutorialState: jest.fn(),
    saveTutorialState: jest.fn()
}));
describe('Tutorial System', () => {
    beforeEach(() => {
        (0, test_setup_1.resetMocks)();
    });
    test('handleTutorialCommand should start a tutorial for new users', () => __awaiter(void 0, void 0, void 0, function* () {
        // Mock getTutorialState to return null (user has no tutorial state)
        storage_1.getTutorialState.mockResolvedValue(null);
        // Create a mock message
        const mockMessage = (0, test_setup_1.createMockMessage)(123456789, '/tutorial');
        // Execute the command
        yield (0, tutorial_system_1.handleTutorialCommand)(mockMessage);
        // Verify tutorial state was saved
        expect(storage_1.saveTutorialState).toHaveBeenCalledWith({
            userId: mockMessage.chat.id,
            currentStep: 0,
            completed: false,
            startedAt: expect.any(Number),
            lastUpdatedAt: expect.any(Number),
            skipped: false
        });
        // Verify a message was sent to the user
        expect(test_setup_1.mockBot.sendMessage).toHaveBeenCalledWith(mockMessage.chat.id, expect.any(String), expect.objectContaining({
            parse_mode: 'Markdown',
            reply_markup: expect.objectContaining({
                inline_keyboard: expect.any(Array)
            })
        }));
    }));
    test('handleSkipCommand should mark tutorial as skipped', () => __awaiter(void 0, void 0, void 0, function* () {
        // Mock an active tutorial
        const mockTutorialState = {
            userId: 123456789,
            currentStep: 2,
            completed: false,
            startedAt: Date.now() - 1000 * 60,
            lastUpdatedAt: Date.now() - 1000 * 30,
            skipped: false
        };
        storage_1.getTutorialState.mockResolvedValue(mockTutorialState);
        // Create a mock message
        const mockMessage = (0, test_setup_1.createMockMessage)(123456789, '/skip');
        // Execute the command
        yield (0, tutorial_system_1.handleSkipCommand)(mockMessage);
        // Verify tutorial state was updated
        expect(storage_1.saveTutorialState).toHaveBeenCalledWith(Object.assign(Object.assign({}, mockTutorialState), { skipped: true }));
        // Verify a message was sent to the user
        expect(test_setup_1.mockBot.sendMessage).toHaveBeenCalledWith(mockMessage.chat.id, 'Tutorial skipped. You can restart it anytime with /tutorial.');
    }));
    test('handleTutorialCallback should navigate to next step', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        // Mock tutorial state
        const mockTutorialState = {
            userId: 123456789,
            currentStep: 1,
            completed: false,
            startedAt: Date.now() - 1000 * 60,
            lastUpdatedAt: Date.now() - 1000 * 30,
            skipped: false
        };
        storage_1.getTutorialState.mockResolvedValue(mockTutorialState);
        // Create mock callback query
        const mockQuery = (0, test_setup_1.createMockCallbackQuery)(123456789, JSON.stringify({ method: 'tutorial_next', data: '' }));
        // Execute callback
        yield (0, tutorial_system_1.handleTutorialCallback)(mockQuery, 'tutorial_next');
        // Verify tutorial state was updated
        expect(storage_1.saveTutorialState).toHaveBeenCalledWith(Object.assign(Object.assign({}, mockTutorialState), { currentStep: 2, lastUpdatedAt: expect.any(Number) }));
        // Verify old message was deleted
        expect(test_setup_1.mockBot.deleteMessage).toHaveBeenCalledWith(mockQuery.from.id, (_a = mockQuery.message) === null || _a === void 0 ? void 0 : _a.message_id);
        // Verify new tutorial step was shown
        expect(test_setup_1.mockBot.sendMessage).toHaveBeenCalled();
    }));
});
//# sourceMappingURL=tutorial-system.test.js.map