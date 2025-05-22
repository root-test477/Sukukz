import TonConnect from '@tonconnect/sdk';
export declare function getConnector(chatId: number, onConnectorExpired?: (connector: TonConnect) => void, botId?: string): TonConnect;
