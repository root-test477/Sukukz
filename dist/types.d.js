// Global type declarations to fix TypeScript errors
declare module 'node-telegram-bot-api' {
  export interface Message {
    message_id
    chat: { id type first_name? last_name? username? title?: string };
    from?: { id is_bot first_name last_name? username? language_code?: string };
    date
    text?
    entities? offset length type: string }>;
    reply_to_message?
    reply_markup?
    [key: string]
  }
  
  export interface CallbackQuery {
    id
    from: { id is_bot first_name last_name? username? language_code?: string };
    message?
    inline_message_id?
    chat_instance
    data?
    game_short_name?
  }

  export interface Bot {
    sendMessage: (chatId | string text options? => Promise<Message>;
    answerCallbackQuery: (callbackQueryId options? => Promise<boolean>;
    editMessageText: (text options? => Promise<Message | boolean>;
    [key: string]
  }
}

declare module 'qrcode';
declare module 'process';
declare module 'http';
declare module 'fs';

// Add any missing types here
// interface Error {
  response?
}
