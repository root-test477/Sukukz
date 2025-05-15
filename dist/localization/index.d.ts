/**
 * Localization system for the Telegram Bot
 * Supporting multiple languages with easy-to-use translation functions
 */
export type SupportedLanguage = 'en' | 'es' | 'fr' | 'ru' | 'pt' | 'ar' | 'zh' | 'hi' | 'bn' | 'ja';
export declare const LANGUAGE_OPTIONS: Record<SupportedLanguage, {
    name: string;
    flag: string;
}>;
export type TranslationKey = 'welcome_message' | 'connect_wallet_instructions' | 'wallet_connected' | 'wallet_disconnected' | 'send_transaction_instructions' | 'transaction_sent' | 'transaction_error' | 'help_message' | 'support_instructions' | 'support_message_received' | 'admin_notification' | 'transaction_approved' | 'transaction_rejected' | 'language_selection' | 'language_changed' | 'tutorial_welcome' | 'tutorial_step_completed' | 'tutorial_completed';
/**
 * Get a translated message for the specified key and language
 * @param key Translation key
 * @param lang Language code
 * @returns Translated message
 */
export declare function getTranslation(key: TranslationKey, lang?: SupportedLanguage): string;
/**
 * Format a translation with placeholders
 * @param key Translation key
 * @param lang Language code
 * @param params Parameters to substitute in the translation
 * @returns Formatted translated message
 */
export declare function formatTranslation(key: TranslationKey, lang?: SupportedLanguage, params?: Record<string, string | number>): string;
