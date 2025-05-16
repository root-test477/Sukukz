import TonConnect from '@tonconnect/sdk';
import { TonConnectStorage } from './storage';
import * as process from 'process';

const DEBUG = process.env.DEBUG_MODE === 'true';

type StoredConnectorData = {
    connector: TonConnect;
    timeout: ReturnType<typeof setTimeout>;
    onConnectorExpired: ((connector: TonConnect) => void)[];
};

const connectors = new Map<number, StoredConnectorData>();

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
export async function getConnectedWallet(userId: number): Promise<ConnectedWallet | null> {
    try {
        // In a real implementation, this would fetch from Redis or other database
        // For this demo we'll simulate a connected wallet for some users
        const storage = new TonConnectStorage(userId);
        const walletData = await storage.getItem('connected_wallet');
        
        if (!walletData) {
            return null;
        }
        
        return JSON.parse(walletData) as ConnectedWallet;
    } catch (error) {
        console.error(`Error getting connected wallet for user ${userId}:`, error);
        return null;
    }
}

/**
 * Disconnect wallet for a user
 */
export async function disconnectWallet(userId: number): Promise<boolean> {
    try {
        // In a real implementation, this would update in Redis or other database
        const storage = new TonConnectStorage(userId);
        await storage.removeItem('connected_wallet');
        
        // Also clean up any connector instances
        if (connectors.has(userId)) {
            const { timeout } = connectors.get(userId)!;
            clearTimeout(timeout);
            connectors.delete(userId);
        }
        
        return true;
    } catch (error) {
        console.error(`Error disconnecting wallet for user ${userId}:`, error);
        return false;
    }
}

/**
 * Retry function for handling network operations that might fail
 */
async function withRetry<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (retries <= 0) throw error;
        if (DEBUG) {
            console.log(`[CONNECTOR] Operation failed, retrying in ${delay}ms... (${retries} retries left)`);
            console.log(`[CONNECTOR] Error:`, error);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(operation, retries - 1, delay * 1.5);
    }
}

export function getConnector(
    chatId: number,
    onConnectorExpired?: (connector: TonConnect) => void
): TonConnect {
    if (DEBUG) {
        console.log(`[CONNECTOR] getConnector for chatId: ${chatId}`);
    }
    let storedItem: StoredConnectorData;
    if (connectors.has(chatId)) {
        storedItem = connectors.get(chatId)!;
        clearTimeout(storedItem.timeout);
    } else {
        if (DEBUG) {
            console.log(`[CONNECTOR] Creating new connector for chatId: ${chatId}`);
        }
        // Log the manifest URL for debugging
        if (DEBUG) {
            console.log(`[CONNECTOR] Using manifest URL: ${process.env.MANIFEST_URL}`);
        }
        
        try {
            storedItem = {
                connector: new TonConnect({
                    manifestUrl: process.env.MANIFEST_URL,
                    storage: new TonConnectStorage(chatId)
                }),
                onConnectorExpired: []
            } as unknown as StoredConnectorData;
        } catch (error) {
            console.error('[CONNECTOR] Error creating connector:', error);
            // Create a fallback connector anyway to avoid runtime errors
            storedItem = {
                connector: new TonConnect({
                    manifestUrl: process.env.MANIFEST_URL,
                    storage: new TonConnectStorage(chatId)
                }),
                onConnectorExpired: []
            } as unknown as StoredConnectorData;
        }
    }

    if (onConnectorExpired) {
        storedItem.onConnectorExpired.push(onConnectorExpired);
    }

    // Create connector TTL
    const TTL = process.env.CONNECTOR_TTL_MS
        ? parseInt(process.env.CONNECTOR_TTL_MS)
        : 10 * 60 * 1000; // 10 minutes by default

    storedItem.timeout = setTimeout(() => {
        if (DEBUG) {
            console.log(`[CONNECTOR] Connector TTL expired for chatId: ${chatId}`)
        }
        storedItem.onConnectorExpired.forEach(cb => cb(storedItem.connector));
        connectors.delete(chatId);
    }, TTL);

    connectors.set(chatId, storedItem);
    
    // Add event listeners for debugging
    if (DEBUG) {
        storedItem.connector.onStatusChange((status: any) => {
            console.log(`[CONNECTOR] Status changed for chatId: ${chatId}, status:`, status);
        });
        
        // Log initial connection state
        console.log(`[CONNECTOR] Initial connection state for chatId: ${chatId}:`, 
            storedItem.connector.connected ? 'Connected' : 'Disconnected');
    }

    if (DEBUG) {
        console.log(`[CONNECTOR] Returning connector for chatId: ${chatId}, connected: ${storedItem.connector.connected}`);
    }

    return storedItem.connector;
}
