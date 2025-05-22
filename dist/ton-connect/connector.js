"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConnector = void 0;
const sdk_1 = __importDefault(require("@tonconnect/sdk"));
const storage_1 = require("./storage");
const process = __importStar(require("process"));
const DEBUG = process.env.DEBUG_MODE === 'true';
// Use a composite key (chatId:botId) to identify connectors
const connectors = new Map();
/**
 * Retry function for handling network operations that might fail
 */
function withRetry(operation, retries = 3, delay = 2000) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield operation();
        }
        catch (error) {
            if (retries <= 0)
                throw error;
            if (DEBUG) {
                console.log(`[CONNECTOR] Operation failed, retrying in ${delay}ms... (${retries} retries left)`);
                console.log(`[CONNECTOR] Error:`, error);
            }
            yield new Promise(resolve => setTimeout(resolve, delay));
            return withRetry(operation, retries - 1, delay * 1.5);
        }
    });
}
function getConnector(chatId, onConnectorExpired, botId = 'primary' // Default to primary bot for backwards compatibility
) {
    if (DEBUG) {
        console.log(`[CONNECTOR] getConnector for chatId: ${chatId}, botId: ${botId}`);
    }
    // Create a composite key using chatId and botId
    const connectorKey = `${chatId}:${botId}`;
    let storedItem;
    if (connectors.has(connectorKey)) {
        storedItem = connectors.get(connectorKey);
        clearTimeout(storedItem.timeout);
    }
    else {
        if (DEBUG) {
            console.log(`[CONNECTOR] Creating new connector for chatId: ${chatId}, botId: ${botId}`);
        }
        // Log the manifest URL for debugging
        if (DEBUG) {
            console.log(`[CONNECTOR] Using manifest URL: ${process.env.MANIFEST_URL}`);
        }
        // Get bot-specific manifest URL if available
        const manifestUrlEnvVar = botId !== 'primary' ? `MANIFEST_URL_${botId.toUpperCase()}` : 'MANIFEST_URL';
        const manifestUrl = process.env[manifestUrlEnvVar] || process.env.MANIFEST_URL;
        if (DEBUG) {
            console.log(`[CONNECTOR] Using manifest URL (${manifestUrlEnvVar}): ${manifestUrl}`);
        }
        try {
            storedItem = {
                connector: new sdk_1.default({
                    manifestUrl,
                    storage: new storage_1.TonConnectStorage(chatId, botId)
                }),
                onConnectorExpired: [],
                botId
            };
        }
        catch (error) {
            console.error('[CONNECTOR] Error creating connector:', error);
            // Create a fallback connector anyway to avoid runtime errors
            storedItem = {
                connector: new sdk_1.default({
                    manifestUrl,
                    storage: new storage_1.TonConnectStorage(chatId, botId)
                }),
                onConnectorExpired: [],
                botId
            };
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
            console.log(`[CONNECTOR] Connector TTL expired for chatId: ${chatId}, botId: ${botId}`);
        }
        storedItem.onConnectorExpired.forEach(cb => cb(storedItem.connector));
        connectors.delete(connectorKey);
    }, TTL);
    connectors.set(connectorKey, storedItem);
    // Add event listeners for debugging
    if (DEBUG) {
        storedItem.connector.onStatusChange((status) => {
            console.log(`[CONNECTOR] Status changed for chatId: ${chatId}, botId: ${botId}, status:`, status);
        });
        // Log initial connection state
        console.log(`[CONNECTOR] Initial connection state for chatId: ${chatId}, botId: ${botId}:`, storedItem.connector.connected ? 'Connected' : 'Disconnected');
    }
    if (DEBUG) {
        console.log(`[CONNECTOR] Returning connector for chatId: ${chatId}, botId: ${botId}, connected: ${storedItem.connector.connected}`);
    }
    return storedItem.connector;
}
exports.getConnector = getConnector;
//# sourceMappingURL=connector.js.map