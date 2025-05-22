// Global type declarations to fix TypeScript errors
declare module 'node-telegram-bot-api' {
  export interface Message {
    message_id: number;
    chat: { id: number; type: string; first_name?: string; last_name?: string; username?: string; title?: string };
    from?: { id: number; is_bot: boolean; first_name: string; last_name?: string; username?: string; language_code?: string };
    date: number;
    text?: string;
    entities?: Array<{ offset: number; length: number; type: string }>;
    reply_to_message?: Message;
    reply_markup?: any;
    [key: string]: any;
  }
  
  export interface CallbackQuery {
    id: string;
    from: { id: number; is_bot: boolean; first_name: string; last_name?: string; username?: string; language_code?: string };
    message?: Message;
    inline_message_id?: string;
    chat_instance: string;
    data?: string;
    game_short_name?: string;
  }

  export interface Bot {
    sendMessage: (chatId: number | string, text: string, options?: any) => Promise<Message>;
    answerCallbackQuery: (callbackQueryId: string, options?: any) => Promise<boolean>;
    editMessageText: (text: string, options?: any) => Promise<Message | boolean>;
    [key: string]: any;
  }
}

declare module 'qrcode';
declare module 'process';
declare module 'http';
declare module 'fs';

// Add any missing types here
interface Error {
  response?: any;
}
