import TonConnect from '@tonconnect/sdk';
import { TonConnectStorage } from './storage';
import * as process from 'process';
import { BotFactory } from '../bot-factory';

const DEBUG = process.env.DEBUG_MODE === 'true';

type StoredConnectorData = {
    connector: TonConnect;
    timeout: ReturnType<typeof setTimeout>;
    onConnectorExpired: ((connector: TonConnect) => void)[];
};

// Use a composite key (chatId:botId) to store connectors
const connectors = new Map<string, StoredConnectorData>();

// Helper function to create a connector key
function getConnectorKey(chatId: number, botId: string): string {
    return `${chatId}:${botId}`;
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
    botId: string,
    onConnectorExpired?: (connector: TonConnect) => void
): TonConnect {
    if (DEBUG) {
        console.log(`[CONNECTOR] getConnector for chatId: ${chatId}, botId: ${botId}`);
    }
    const connectorKey = getConnectorKey(chatId, botId);
    
    let storedItem: StoredConnectorData;
    if (connectors.has(connectorKey)) {
        storedItem = connectors.get(connectorKey)!;
        clearTimeout(storedItem.timeout);
    } else {
        if (DEBUG) {
            console.log(`[CONNECTOR] Creating new connector for chatId: ${chatId}, botId: ${botId}`);
        }
        
        // Get bot-specific manifest URL from bot factory
        const botFactory = BotFactory.getInstance();
        const botConfig = botFactory.getBotConfig(botId);
        
        // Use a local manifest URL instead of external one to avoid CORS issues
        // Format: http://localhost:PORT/tonconnect-manifest-botId.json or /tonconnect-manifest.json for default
        const PORT = process.env.PORT || 10000;
        const hostname = process.env.HOST || 'localhost';
        const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
        
        // Create a local manifest URL for this specific bot
        let manifestUrl = `${protocol}://${hostname}:${PORT}/tonconnect-manifest-${botId}.json`;
        
        // Fall back to config or env if specified
        if (botConfig?.manifestUrl) {
            manifestUrl = botConfig.manifestUrl;
        } else if (process.env.MANIFEST_URL) {
            manifestUrl = process.env.MANIFEST_URL;
        }
        
        // Log the manifest URL for debugging
        if (DEBUG) {
            console.log(`[CONNECTOR] Using manifest URL: ${manifestUrl} for botId: ${botId}`);
        }
        
        try {
            storedItem = {
                connector: new TonConnect({
                    manifestUrl: manifestUrl,
                    storage: new TonConnectStorage(chatId, botId)
                }),
                onConnectorExpired: []
            } as unknown as StoredConnectorData;
        } catch (error) {
            console.error('[CONNECTOR] Error creating connector:', error);
            // Create a fallback connector anyway to avoid runtime errors
            storedItem = {
                connector: new TonConnect({
                    manifestUrl: manifestUrl,
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
