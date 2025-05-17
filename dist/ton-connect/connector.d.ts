import TonConnect from '@tonconnect/sdk';
export declare function getConnector(chatId: number, onConnectorExpired?: (connector: TonConnect) => void): TonConnect;
/**
 * Check if a wallet is connected for a chat ID
 * @param chatId - The chat ID to check
 * @returns The wallet address if connected, null otherwise
 */
export declare function getConnectedWallet(chatId: number): Promise<string | null>;
/**
 * Disconnect a wallet for a chat ID
 * @param chatId - The chat ID to disconnect
 */
export declare function disconnectWallet(chatId: number): Promise<void>;
