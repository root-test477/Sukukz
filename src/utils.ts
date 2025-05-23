import { encodeTelegramUrlParameters, isTelegramUrl, WalletInfoRemote } from '@tonconnect/sdk';
import { InlineKeyboardButton } from 'node-telegram-bot-api';
import { BotFactory } from './bot-factory';

export const AT_WALLET_APP_NAME = 'telegram-wallet';

export const pTimeoutException = Symbol();

/**
 * Check if a user is an admin based on their chat ID and bot ID
 * @param chatId - Telegram chat ID to check
 * @param botId - Bot ID to check against
 * @returns true if the user is an admin for the specified bot, false otherwise
 */
export function isAdmin(chatId: number, botId: string): boolean {
    // First try to get admin list from bot factory
    const botFactory = BotFactory.getInstance();
    if (botFactory.isAdmin(botId, chatId)) {
        return true;
    }
    
    // Fallback to legacy environment variable (if bot-specific admin list is not available)
    const legacyAdminIds = process.env.ADMIN_IDS?.split(',').map(id => Number(id.trim())) || [];
    return legacyAdminIds.includes(chatId);
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
    botId?: string
): Promise<InlineKeyboardButton[]> {
    const atWallet = wallets.find(wallet => wallet.appName.toLowerCase() === AT_WALLET_APP_NAME);
    
    // Get bot-specific link if available
    let botLink = process.env.TELEGRAM_BOT_LINK;
    if (botId) {
        const botFactory = BotFactory.getInstance();
        const botConfig = botFactory.getBotConfig(botId);
        if (botConfig?.link) {
            botLink = botConfig.link;
        }
    }
    
    const atWalletLink = atWallet
        ? addTGReturnStrategy(
              convertDeeplinkToUniversalLink(link, atWallet?.universalLink),
              botLink || ''
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
