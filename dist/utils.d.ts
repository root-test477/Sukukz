import { WalletInfoRemote } from '@tonconnect/sdk';
import { InlineKeyboardButton } from 'node-telegram-bot-api';
export declare const AT_WALLET_APP_NAME = "telegram-wallet";
export declare const pTimeoutException: unique symbol;
/**
 * Check if a user is an admin based on their chat ID and bot ID
 * @param chatId - Telegram chat ID to check
 * @param botId - Bot ID to check against
 * @returns true if the user is an admin for the specified bot, false otherwise
 */
export declare function isAdmin(chatId: number, botId: string): boolean;
export declare function pTimeout<T>(promise: Promise<T>, time: number, exception?: unknown): Promise<T>;
export declare function addTGReturnStrategy(link: string, strategy: string): string;
export declare function convertDeeplinkToUniversalLink(link: string, walletUniversalLink: string): string;
export declare function buildUniversalKeyboard(link: string, wallets: WalletInfoRemote[], botId?: string): Promise<InlineKeyboardButton[]>;
