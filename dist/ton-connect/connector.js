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
function getConnector(chatId, onConnectorExpired) {
    if (DEBUG) {
        console.log(`[CONNECTOR] getConnector for chatId: ${chatId}`);
    }
    let storedItem;
    if (connectors.has(chatId)) {
        storedItem = connectors.get(chatId);
        clearTimeout(storedItem.timeout);
    }
    else {
        if (DEBUG) {
            console.log(`[CONNECTOR] Creating new connector for chatId: ${chatId}`);
        }
        storedItem = {
            connector: new sdk_1.default({
                manifestUrl: process.env.MANIFEST_URL,
                storage: new storage_1.TonConnectStorage(chatId)
            }),
            onConnectorExpired: []
        };
    }
    if (onConnectorExpired) {
        storedItem.onConnectorExpired.push(onConnectorExpired);
    }
    storedItem.timeout = setTimeout(() => {
        if (connectors.has(chatId)) {
            const storedItem = connectors.get(chatId);
            storedItem.connector.pauseConnection();
            storedItem.onConnectorExpired.forEach(callback => callback(storedItem.connector));
            connectors.delete(chatId);
        }
    }, Number(process.env.CONNECTOR_TTL_MS));
    connectors.set(chatId, storedItem);
    if (DEBUG) {
        console.log(`[CONNECTOR] Returning connector for chatId: ${chatId}, connected: ${storedItem.connector.connected}`);
    }
    return storedItem.connector;
}
exports.getConnector = getConnector;
//# sourceMappingURL=connector.js.map