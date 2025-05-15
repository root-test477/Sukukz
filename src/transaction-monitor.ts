import TelegramBot from 'node-telegram-bot-api';
import { bot } from './bot';
import { SupportedLanguage, getTranslation } from './localization';

// Temporary function until storage is fully integrated
async function getUserLanguage(_chatId: number): Promise<string> {
  return 'en'; // Default to English
}
import { BotError, ErrorHandler } from './error-handler';

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
export class TransactionMonitor {
  private static transactions: Map<string, TransactionDetails> = new Map();
  private static updateInterval: NodeJS.Timeout | null = null;
  private static readonly UPDATE_FREQUENCY_MS = 30000; // Check every 30 seconds
  private static readonly MAX_CONFIRMATIONS = 10; // Number of confirmations to consider a transaction fully confirmed
  
  /**
   * Start transaction monitoring service
   */
  public static startMonitoring(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(() => this.checkTransactions(), this.UPDATE_FREQUENCY_MS);
    console.log('Transaction monitor started');
  }
  
  /**
   * Stop transaction monitoring service
   */
  public static stopMonitoring(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    console.log('Transaction monitor stopped');
  }
  
  /**
   * Track a new transaction
   */
  public static async trackTransaction(details: Omit<TransactionDetails, 'status' | 'lastUpdated'>): Promise<void> {
    const transactionDetails: TransactionDetails = {
      ...details,
      status: 'pending',
      lastUpdated: Date.now()
    };
    
    this.transactions.set(details.id, transactionDetails);
    
    // Notify user that we're monitoring their transaction
    const language = await getUserLanguage(details.chatId) as SupportedLanguage;
    await bot.sendMessage(
      details.chatId,
      `🔄 *Monitoring Transaction*\n\nTransaction ID: \`${details.id}\`\nAmount: ${(Number(details.amount) / 1000000000).toFixed(2)} TON\n\nYou will be notified when the status changes.`,
      { parse_mode: 'Markdown' }
    );
  }
  
  /**
   * Update transaction status
   */
  public static async updateTransactionStatus(
    id: string,
    status: TransactionStatus,
    details?: Partial<TransactionDetails>
  ): Promise<void> {
    const transaction = this.transactions.get(id);
    if (!transaction) return;
    
    transaction.status = status;
    transaction.lastUpdated = Date.now();
    
    // Update other details if provided
    if (details) {
      Object.assign(transaction, details);
    }
    
    // Save updated transaction
    this.transactions.set(id, transaction);
    
    // Notify user of status change
    await this.notifyUser(transaction);
    
    // Clean up completed/failed transactions after notification
    if (status === 'confirmed' || status === 'rejected' || status === 'failed') {
      // Keep in memory for a while (10 minutes) before removing
      setTimeout(() => {
        this.transactions.delete(id);
      }, 10 * 60 * 1000);
    }
  }
  
  /**
   * Notify user of transaction status changes
   */
  private static async notifyUser(transaction: TransactionDetails): Promise<void> {
    try {
      const language = await getUserLanguage(transaction.chatId) as SupportedLanguage;
      let message = '';
      
      switch (transaction.status) {
        case 'pending':
          if (transaction.confirmations && transaction.confirmations > 0) {
            message = `🕒 *Transaction Update*\n\nTransaction ID: \`${transaction.id}\`\nStatus: Pending\nConfirmations: ${transaction.confirmations}/${this.MAX_CONFIRMATIONS}\n\nYour transaction is being processed.`;
          }
          break;
          
        case 'confirmed':
          message = `✅ *Transaction Confirmed*\n\nTransaction ID: \`${transaction.id}\`\nAmount: ${(Number(transaction.amount) / 1000000000).toFixed(2)} TON\n\nYour transaction has been successfully confirmed on the blockchain.`;
          if (transaction.blockHash) {
            message += `\nBlock Hash: \`${transaction.blockHash}\``;
          }
          break;
          
        case 'rejected':
          message = `❌ *Transaction Rejected*\n\nTransaction ID: \`${transaction.id}\`\n\nYour transaction was rejected. This might happen if you canceled the transaction in your wallet.`;
          break;
          
        case 'failed':
          message = `❌ *Transaction Failed*\n\nTransaction ID: \`${transaction.id}\`\n\nYour transaction failed to process.`;
          if (transaction.error) {
            message += `\nError: ${transaction.error}`;
          }
          break;
      }
      
      // Only send notification if there's a message to send
      if (message) {
        await bot.sendMessage(transaction.chatId, message, { parse_mode: 'Markdown' });
      }
    } catch (error) {
      // Log error but don't fail the whole monitor
      const botError = new BotError(
        `Failed to send transaction notification: ${error instanceof Error ? error.message : String(error)}`,
        { severity: 'medium' }
      );
      await ErrorHandler.handleError(botError);
    }
  }
  
  /**
   * Check all pending transactions for updates
   */
  private static async checkTransactions(): Promise<void> {
    const now = Date.now();
    const pendingTransactions = Array.from(this.transactions.values())
      .filter(tx => tx.status === 'pending');
    
    if (pendingTransactions.length === 0) return;
    
    console.log(`Checking ${pendingTransactions.length} pending transactions...`);
    
    for (const transaction of pendingTransactions) {
      try {
        // Here you would typically call the blockchain API to get transaction status
        // For this demo, we'll simulate status updates based on time elapsed
        await this.simulateTransactionCheck(transaction);
      } catch (error) {
        console.error(`Error checking transaction ${transaction.id}:`, error);
      }
    }
  }
  
  /**
   * Simulate checking a transaction status (for demo purposes)
   * In a real implementation, this would call the TON API
   */
  private static async simulateTransactionCheck(transaction: TransactionDetails): Promise<void> {
    const elapsedTime = Date.now() - transaction.timestamp;
    
    // Simulate transaction confirmation process
    // In a real implementation, this would check the actual blockchain state
    
    // 1-2 minutes: Pending with increasing confirmations
    if (elapsedTime < 120000) {
      const confirmations = Math.floor(elapsedTime / 20000); // Roughly one confirmation every 20 seconds
      const currentConfirmations = transaction.confirmations || 0; // Default to 0 if undefined
      if (confirmations > currentConfirmations) {
        await this.updateTransactionStatus('pending', 'pending', { confirmations });
      }
      return;
    }
    
    // After 2 minutes: 90% chance of confirmation, 5% rejection, 5% failure
    const random = Math.random();
    if (random < 0.9) {
      await this.updateTransactionStatus(transaction.id, 'confirmed', {
        confirmations: this.MAX_CONFIRMATIONS,
        blockHash: `ton_block_${Math.random().toString(36).substring(2, 10)}`
      });
    } else if (random < 0.95) {
      await this.updateTransactionStatus(transaction.id, 'rejected');
    } else {
      await this.updateTransactionStatus(transaction.id, 'failed', {
        error: 'Insufficient funds for gas'
      });
    }
  }
}
