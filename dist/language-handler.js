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
exports.handleLanguageCallback = exports.handleLanguageCommand = void 0;
const bot_1 = require("./bot");
const localization_1 = require("./localization");
const storage_1 = require("./ton-connect/storage");
// Use the actual storage implementations
/**
 * Handle the /language command
 * This allows users to select their preferred language
 */
function handleLanguageCommand(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        const currentLanguage = yield (0, storage_1.getUserLanguage)(chatId);
        // Create keyboard with language options
        const keyboard = [];
        Object.entries(localization_1.LANGUAGE_OPTIONS).forEach(([code, { name, flag }]) => {
            // Create a row for each language
            const label = currentLanguage === code ? `${flag} ${name} ✓` : `${flag} ${name}`;
            keyboard.push([
                { text: label, callback_data: `lang_${code}` }
            ]);
        });
        // Add a cancel button
        keyboard.push([{ text: '❌ Cancel', callback_data: 'lang_cancel' }]);
        yield bot_1.bot.sendMessage(chatId, (0, localization_1.getTranslation)('language_selection', currentLanguage), {
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    });
}
exports.handleLanguageCommand = handleLanguageCommand;
/**
 * Handle language selection callback
 */
function handleLanguageCallback(query) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!query.data || !query.message)
            return;
        const chatId = query.message.chat.id;
        const action = query.data.substring(5); // Remove 'lang_' prefix
        if (action === 'cancel') {
            // User canceled language selection
            yield bot_1.bot.answerCallbackQuery(query.id, { text: 'Language selection canceled' });
            yield bot_1.bot.deleteMessage(chatId, query.message.message_id);
            return;
        }
        // Validate language code
        if (action in localization_1.LANGUAGE_OPTIONS) {
            const languageCode = action;
            // Save user's language preference
            yield (0, storage_1.setUserLanguage)(chatId, languageCode);
            // Confirm selection
            yield bot_1.bot.answerCallbackQuery(query.id, {
                text: localization_1.LANGUAGE_OPTIONS[languageCode].name + ' selected!'
            });
            // Update message with confirmation
            yield bot_1.bot.editMessageText((0, localization_1.getTranslation)('language_changed', languageCode), {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '👍', callback_data: 'lang_done' }]
                    ]
                }
            });
        }
        else if (action === 'done') {
            // Clean up the UI by removing the message
            yield bot_1.bot.deleteMessage(chatId, query.message.message_id);
        }
    });
}
exports.handleLanguageCallback = handleLanguageCallback;
//# sourceMappingURL=language-handler.js.map