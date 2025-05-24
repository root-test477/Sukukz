import TonConnect from '@tonconnect/sdk';
import { TonConnectStorage } from './storage';
import * as process from 'process';
import { botManager } from '../bot-manager';

const DEBUG = process.env.DEBUG_MODE === 'true';

type StoredConnectorData = {
    connector: TonConnect;
    timeout: ReturnType<typeof setTimeout>;
    onConnectorExpired: ((connector: TonConnect) => void)[];
};

// Use composite key (chatId:botId) to store connectors
const connectors = new Map<string, StoredConnectorData>();

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
    botId: string,
    onConnectorExpired?: (connector: TonConnect) => void
): TonConnect {
    if (DEBUG) {
        console.log(`[CONNECTOR] getConnector for chatId: ${chatId}, botId: ${botId}`);
    }
    
    const connectorKey = `${chatId}:${botId}`;
    let storedItem: StoredConnectorData;
    
    if (connectors.has(connectorKey)) {
        storedItem = connectors.get(connectorKey)!;
        clearTimeout(storedItem.timeout);
    } else {
        if (DEBUG) {
            console.log(`[CONNECTOR] Creating new connector for chatId: ${chatId}, botId: ${botId}`);
        }
        
        // Get bot-specific manifest URL if available
        const manifestUrl = botManager.getManifestUrl(botId);
        
        // Log the manifest URL for debugging
        if (DEBUG) {
            console.log(`[CONNECTOR] Using manifest URL: ${manifestUrl}`);
        }
        
        try {
            storedItem = {
                connector: new TonConnect({
                    manifestUrl,
                    storage: new TonConnectStorage(chatId, botId)
                }),
                onConnectorExpired: []
            } as unknown as StoredConnectorData;
        } catch (error) {
            console.error(`[CONNECTOR] Error creating connector for bot ${botId}:`, error);
            // Create a fallback connector anyway to avoid runtime errors
            storedItem = {
                connector: new TonConnect({
                    manifestUrl,
                    storage: new TonConnectStorage(chatId, botId)
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
            console.log(`[CONNECTOR] Connector TTL expired for chatId: ${chatId}, botId: ${botId}`)
        }
        storedItem.onConnectorExpired.forEach(cb => cb(storedItem.connector));
        connectors.delete(connectorKey);
    }, TTL);

    connectors.set(connectorKey, storedItem);
    
    // Add event listeners for debugging
    if (DEBUG) {
        storedItem.connector.onStatusChange((status: any) => {
            console.log(`[CONNECTOR] Status changed for chatId: ${chatId}, botId: ${botId}, status:`, status);
        });
        
        // Log initial connection state
        console.log(`[CONNECTOR] Initial connection state for chatId: ${chatId}, botId: ${botId}:`, 
            storedItem.connector.connected ? 'Connected' : 'Disconnected');
    }

    if (DEBUG) {
        console.log(`[CONNECTOR] Returning connector for chatId: ${chatId}, botId: ${botId}, connected: ${storedItem.connector.connected}`);
    }

    return storedItem.connector;
}
