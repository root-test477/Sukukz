import TelegramBot from 'node-telegram-bot-api';
import { bot } from './bot';
import { LANGUAGE_OPTIONS, SupportedLanguage, getTranslation } from './localization';

// These functions are now defined in storage.ts, but let's use temporary placeholders
// until we can properly hook them up
async function getUserLanguage(_chatId: number): Promise<string> {
  return 'en'; // Default to English
}

async function setUserLanguage(chatId: number, language: string): Promise<void> {
  console.log(`Setting language for ${chatId} to ${language}`);
  // Will be implemented with proper storage later
}

/**
 * Handle the /language command
 * This allows users to select their preferred language
 */
export async function handleLanguageCommand(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const currentLanguage = await getUserLanguage(chatId) as SupportedLanguage;
  
  // Create keyboard with language options
  const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
  
  Object.entries(LANGUAGE_OPTIONS).forEach(([code, { name, flag }]) => {
    // Create a row for each language
    const label = currentLanguage === code ? `${flag} ${name} ✓` : `${flag} ${name}`;
    
    keyboard.push([
      { text: label, callback_data: `lang_${code}` }
    ]);
  });
  
  // Add a cancel button
  keyboard.push([{ text: '❌ Cancel', callback_data: 'lang_cancel' }]);
  
  await bot.sendMessage(
    chatId,
    getTranslation('language_selection', currentLanguage),
    {
      reply_markup: {
        inline_keyboard: keyboard
      }
    }
  );
}

/**
 * Handle language selection callback
 */
export async function handleLanguageCallback(query: TelegramBot.CallbackQuery): Promise<void> {
  if (!query.data || !query.message) return;
  
  const chatId = query.message.chat.id;
  const action = query.data.substring(5); // Remove 'lang_' prefix
  
  if (action === 'cancel') {
    // User canceled language selection
    await bot.answerCallbackQuery(query.id, { text: 'Language selection canceled' });
    await bot.deleteMessage(chatId, query.message.message_id);
    return;
  }
  
  // Validate language code
  if (action in LANGUAGE_OPTIONS) {
    const languageCode = action as SupportedLanguage;
    
    // Save user's language preference
    await setUserLanguage(chatId, languageCode);
    
    // Confirm selection
    await bot.answerCallbackQuery(query.id, {
      text: LANGUAGE_OPTIONS[languageCode].name + ' selected!'
    });
    
    // Update message with confirmation
    await bot.editMessageText(
      getTranslation('language_changed', languageCode),
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: '👍', callback_data: 'lang_done' }]
          ]
        }
      }
    );
  } else if (action === 'done') {
    // Clean up the UI by removing the message
    await bot.deleteMessage(chatId, query.message.message_id);
  }
}
