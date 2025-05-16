import TonConnect from '@tonconnect/sdk';
/**
 * Interface for connected wallet information
 */
export interface ConnectedWallet {
    address: string;
    walletName: string;
    connectedAt: number;
    lastActive: number;
}
/**
 * Get connected wallet for a user
 */
export declare function getConnectedWallet(userId: number): Promise<ConnectedWallet | null>;
/**
 * Disconnect wallet for a user
 */
export declare function disconnectWallet(userId: number): Promise<boolean>;
export declare function getConnector(chatId: number, onConnectorExpired?: (connector: TonConnect) => void): TonConnect;
