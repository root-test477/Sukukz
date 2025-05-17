/**
 * Custom error types for the bot
 */

export enum ErrorType {
  COMMAND_ERROR = 'command_error',
  API_ERROR = 'api_error',
  STORAGE_ERROR = 'storage_error',
  WALLET_ERROR = 'wallet_error',
  SYSTEM_ERROR = 'system_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Extended Error class with additional properties
 */
export class BotError extends Error {
  type: ErrorType;
  userId?: number;
  command?: string;
  timestamp: number;
  stack?: any;

  constructor(
    message: string, 
    type: ErrorType = ErrorType.UNKNOWN_ERROR, 
    userId?: number,
    command?: string
  ) {
    super(message);
    this.name = 'BotError';
    this.type = type;
    this.userId = userId;
    this.command = command;
    this.timestamp = Date.now();
  }

  /**
   * Convert a standard error into a BotError
   */
  static fromError(
    error: Error, 
    type: ErrorType = ErrorType.UNKNOWN_ERROR, 
    userId?: number,
    command?: string
  ): BotError {
    const botError = new BotError(error.message, type, userId, command);
    botError.stack = error.stack;
    return botError;
  }
  
  /**
   * Convert to a plain object for storage
   */
  toObject() {
    return {
      type: this.type,
      message: this.message,
      command: this.command,
      userId: this.userId,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}
