"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionMonitor = void 0;
const bot_1 = require("./bot");
// Temporary function until storage is fully integrated
function getUserLanguage(_chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        return 'en'; // Default to English
    });
}
const error_handler_1 = require("./error-handler");
/**
 * Monitors blockchain transactions and notifies users of status changes
 */
class TransactionMonitor {
    /**
     * Start transaction monitoring service
     */
    static startMonitoring() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.updateInterval = setInterval(() => this.checkTransactions(), this.UPDATE_FREQUENCY_MS);
        console.log('Transaction monitor started');
    }
    /**
     * Stop transaction monitoring service
     */
    static stopMonitoring() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        console.log('Transaction monitor stopped');
    }
    /**
     * Track a new transaction
     */
    static trackTransaction(details) {
        return __awaiter(this, void 0, void 0, function* () {
            const transactionDetails = Object.assign(Object.assign({}, details), { status: 'pending', lastUpdated: Date.now() });
            this.transactions.set(details.id, transactionDetails);
            // Notify user that we're monitoring their transaction
            const language = yield getUserLanguage(details.chatId);
            yield bot_1.bot.sendMessage(details.chatId, `🔄 *Monitoring Transaction*\n\nTransaction ID: \`${details.id}\`\nAmount: ${(Number(details.amount) / 1000000000).toFixed(2)} TON\n\nYou will be notified when the status changes.`, { parse_mode: 'Markdown' });
        });
    }
    /**
     * Update transaction status
     */
    static updateTransactionStatus(id, status, details) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = this.transactions.get(id);
            if (!transaction)
                return;
            transaction.status = status;
            transaction.lastUpdated = Date.now();
            // Update other details if provided
            if (details) {
                Object.assign(transaction, details);
            }
            // Save updated transaction
            this.transactions.set(id, transaction);
            // Notify user of status change
            yield this.notifyUser(transaction);
            // Clean up completed/failed transactions after notification
            if (status === 'confirmed' || status === 'rejected' || status === 'failed') {
                // Keep in memory for a while (10 minutes) before removing
                setTimeout(() => {
                    this.transactions.delete(id);
                }, 10 * 60 * 1000);
            }
        });
    }
    /**
     * Notify user of transaction status changes
     */
    static notifyUser(transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const language = yield getUserLanguage(transaction.chatId);
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
                    yield bot_1.bot.sendMessage(transaction.chatId, message, { parse_mode: 'Markdown' });
                }
            }
            catch (error) {
                // Log error but don't fail the whole monitor
                const botError = new error_handler_1.BotError(`Failed to send transaction notification: ${error instanceof Error ? error.message : String(error)}`, { severity: 'medium' });
                yield error_handler_1.ErrorHandler.handleError(botError);
            }
        });
    }
    /**
     * Check all pending transactions for updates
     */
    static checkTransactions() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = Date.now();
            const pendingTransactions = Array.from(this.transactions.values())
                .filter(tx => tx.status === 'pending');
            if (pendingTransactions.length === 0)
                return;
            console.log(`Checking ${pendingTransactions.length} pending transactions...`);
            for (const transaction of pendingTransactions) {
                try {
                    // Here you would typically call the blockchain API to get transaction status
                    // For this demo, we'll simulate status updates based on time elapsed
                    yield this.simulateTransactionCheck(transaction);
                }
                catch (error) {
                    console.error(`Error checking transaction ${transaction.id}:`, error);
                }
            }
        });
    }
    /**
     * Simulate checking a transaction status (for demo purposes)
     * In a real implementation, this would call the TON API
     */
    static simulateTransactionCheck(transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const elapsedTime = Date.now() - transaction.timestamp;
            // Simulate transaction confirmation process
            // In a real implementation, this would check the actual blockchain state
            // 1-2 minutes: Pending with increasing confirmations
            if (elapsedTime < 120000) {
                const confirmations = Math.floor(elapsedTime / 20000); // Roughly one confirmation every 20 seconds
                const currentConfirmations = transaction.confirmations || 0; // Default to 0 if undefined
                if (confirmations > currentConfirmations) {
                    yield this.updateTransactionStatus('pending', 'pending', { confirmations });
                }
                return;
            }
            // After 2 minutes: 90% chance of confirmation, 5% rejection, 5% failure
            const random = Math.random();
            if (random < 0.9) {
                yield this.updateTransactionStatus(transaction.id, 'confirmed', {
                    confirmations: this.MAX_CONFIRMATIONS,
                    blockHash: `ton_block_${Math.random().toString(36).substring(2, 10)}`
                });
            }
            else if (random < 0.95) {
                yield this.updateTransactionStatus(transaction.id, 'rejected');
            }
            else {
                yield this.updateTransactionStatus(transaction.id, 'failed', {
                    error: 'Insufficient funds for gas'
                });
            }
        });
    }
}
exports.TransactionMonitor = TransactionMonitor;
TransactionMonitor.transactions = new Map();
TransactionMonitor.updateInterval = null;
TransactionMonitor.UPDATE_FREQUENCY_MS = 30000; // Check every 30 seconds
TransactionMonitor.MAX_CONFIRMATIONS = 10; // Number of confirmations to consider a transaction fully confirmed
//# sourceMappingURL=transaction-monitor.js.map