/**
 * Transaction Status Type
 */
export type TransactionStatus = 'pending' | 'confirmed' | 'rejected' | 'failed';
/**
 * Transaction Details Interface
 */
export interface TransactionDetails {
    id: string;
    chatId: number;
    amount: string;
    address: string;
    timestamp: number;
    status: TransactionStatus;
    lastUpdated: number;
    confirmations?: number;
    blockHash?: string;
    error?: string;
}
/**
 * Monitors blockchain transactions and notifies users of status changes
 */
export declare class TransactionMonitor {
    private static transactions;
    private static updateInterval;
    private static readonly UPDATE_FREQUENCY_MS;
    private static readonly MAX_CONFIRMATIONS;
    /**
     * Start transaction monitoring service
     */
    static startMonitoring(): void;
    /**
     * Stop transaction monitoring service
     */
    static stopMonitoring(): void;
    /**
     * Track a new transaction
     */
    static trackTransaction(details: Omit<TransactionDetails, 'status' | 'lastUpdated'>): Promise<void>;
    /**
     * Update transaction status
     */
    static updateTransactionStatus(id: string, status: TransactionStatus, details?: Partial<TransactionDetails>): Promise<void>;
    /**
     * Notify user of transaction status changes
     */
    private static notifyUser;
    /**
     * Check all pending transactions for updates
     */
    private static checkTransactions;
    /**
     * Simulate checking a transaction status (for demo purposes)
     * In a real implementation, this would call the TON API
     */
    private static simulateTransactionCheck;
}
