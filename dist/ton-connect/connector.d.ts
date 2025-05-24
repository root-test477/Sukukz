import TonConnect from '@tonconnect/sdk';
export declare function getConnector(chatId: number, botId: string, onConnectorExpired?: (connector: TonConnect) => void): TonConnect;
