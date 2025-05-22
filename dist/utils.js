import { encodeTelegramUrlParameters, isTelegramUrl, WalletInfoRemote } from "@tonconnect/sdk";
import { InlineKeyboardButton } from "node-telegram-bot-api";

export const AT_WALLET_APP_NAME = 'telegram-wallet';

export const pTimeoutException = Symbol();

/**
 * Check if a user is an admin based on their chat ID
 * @param chatId - Telegram chat ID to check
 * @param botId - Optional bot ID to check for bot-specific admins
 * @returns true if the user is an admin, false otherwise
 */
export function isAdmin(chatId botId?
    // Global admin IDs that have access to all bots
    const globalAdminIds = process.env.ADMIN_IDS?.split(',').map(id => Number(id.trim())) || [];
    
    // Check if user is a global admin
    if (globalAdminIds.includes(chatId)) {
        return true;
    }
    
    // If botId is provided, check for bot-specific admin IDs
    if (botId) {
        const botSpecificAdminIdsEnv = process.env[`ADMIN_IDS_${botId.toUpperCase()}`];
        if (botSpecificAdminIdsEnv) {
            const botSpecificAdminIds = botSpecificAdminIdsEnv.split(',').map(id => Number(id.trim()));
            return botSpecificAdminIds.includes(chatId);
        }
    }
    
    return false;
}

export function pTimeout<T>(
    promise
    time
    exception pTimeoutException
)
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
        promise,
        new Promise((_r, rej) => (timer = setTimeout(rej, time, exception)))
    ]).finally(() => clearTimeout(timer)) as Promise<T>;
}

export function addTGReturnStrategy(link strategy
    const parsed = new URL(link);
    parsed.searchParams.append('ret', strategy);
    link = parsed.toString();

    const lastParam = link.slice(link.lastIndexOf('&') + 1);
    return link.slice(0, link.lastIndexOf('&')) + '-' + encodeTelegramUrlParameters(lastParam);
}

export function convertDeeplinkToUniversalLink(link walletUniversalLink
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
    link
    wallets
    const atWallet = wallets.find(wallet => wallet.appName.toLowerCase() === AT_WALLET_APP_NAME);
    const atWalletLink = atWallet
        ? addTGReturnStrategy(
              convertDeeplinkToUniversalLink(link, atWallet?.universalLink),
              process.env.TELEGRAM_BOT_LINK!
          )
        

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
