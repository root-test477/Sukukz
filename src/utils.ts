import { encodeTelegramUrlParameters, isTelegramUrl, WalletInfoRemote } from '@tonconnect/sdk';
import { InlineKeyboardButton } from 'node-telegram-bot-api';
import { botManager } from './bot-manager';
import { UserData } from './ton-connect/storage';

// Re-export UserData as User for consistency
export type User = UserData;

// Import the Redis client directly to access it for our functions
import { createClient } from 'redis';
const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Function to get a user by their ID
export async function getUserById(chatId: number): Promise<User | null> {
    try {
        // Make sure Redis client is connected
        if (!client.isOpen) {
            await client.connect();
        }
        
        // Fetch all keys that match this chat ID pattern (across all bots)
        const keys = await client.keys(`user:${chatId}:*`);
        
        if (keys.length === 0) {
            return null;
        }
        
        // Get the most recently active user record
        let mostRecentUser: User | null = null;
        
        for (const key of keys) {
            const userData = await client.get(key);
            if (userData) {
                const user = JSON.parse(userData) as User;
                
                // Keep track of the most recently active user
                if (!mostRecentUser || (user.lastActivity > mostRecentUser.lastActivity)) {
                    mostRecentUser = user;
                }
            }
        }
        
        return mostRecentUser;
    } catch (error) {
        console.error(`Error fetching user ${chatId}:`, error);
        return null;
    }
}

export const AT_WALLET_APP_NAME = 'telegram-wallet';

export const pTimeoutException = Symbol();

/**
 * Check if a user is an admin based on their chat ID and the bot they're interacting with
 * @param chatId - Telegram chat ID to check
 * @param botId - ID of the bot the user is interacting with
 * @returns true if the user is an admin for this bot, false otherwise
 */
export function isAdmin(chatId: number, botId: string): boolean {
    return botManager.isAdmin(chatId, botId);
}

export function pTimeout<T>(
    promise: Promise<T>,
    time: number,
    exception: unknown = pTimeoutException
): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
        promise,
        new Promise((_r, rej) => (timer = setTimeout(rej, time, exception)))
    ]).finally(() => clearTimeout(timer)) as Promise<T>;
}

export function addTGReturnStrategy(link: string, strategy: string): string {
    const parsed = new URL(link);
    parsed.searchParams.append('ret', strategy);
    link = parsed.toString();

    const lastParam = link.slice(link.lastIndexOf('&') + 1);
    return link.slice(0, link.lastIndexOf('&')) + '-' + encodeTelegramUrlParameters(lastParam);
}

export function convertDeeplinkToUniversalLink(link: string, walletUniversalLink: string): string {
    const search = new URL(link).search;
    const url = new URL(walletUniversalLink);

    if (isTelegramUrl(walletUniversalLink)) {
        const startattach = 'tonconnect-' + encodeTelegramUrlParameters(search.slice(1));
        url.searchParams.append('startattach', startattach);
    } else {
        url.search = search;
    }

    return url.toString();
}

export async function buildUniversalKeyboard(
    link: string,
    wallets: WalletInfoRemote[],
    botId: string
): Promise<InlineKeyboardButton[]> {
    const atWallet = wallets.find(wallet => wallet.appName.toLowerCase() === AT_WALLET_APP_NAME);
    
    // Get bot-specific link
    const botLink = botManager.getBotConfig(botId)?.link || process.env.TELEGRAM_BOT_LINK || '';
    
    const atWalletLink = atWallet
        ? addTGReturnStrategy(
              convertDeeplinkToUniversalLink(link, atWallet?.universalLink),
              botLink
          )
        : undefined;

    const keyboard = [
        {
            text: 'Choose a Wallet',
            callback_data: JSON.stringify({ method: 'chose_wallet' })
        },
        {
            text: 'Open Link',
            url: `https://ton-connect.github.io/open-tc?connect=${encodeURIComponent(link)}`
        }
    ];

    if (atWalletLink) {
        keyboard.unshift({
            text: '@wallet',
            url: atWalletLink
        });
    }

    return keyboard;
}
