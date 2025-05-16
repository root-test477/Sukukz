# TON Connect Telegram Bot

A robust Telegram bot for connecting to TON wallets, submitting transactions, and providing customer support.

## Features

### Core Functionality
- Connect/disconnect TON wallets via the TonConnect protocol
- View wallet information and balance
- Interactive tutorial system for new users
- Transaction submission and approval workflow
- Support system for user assistance
- Withdrawal interface integration
- Comprehensive help system

### Technical Features
- Error boundary system to prevent command failures from crashing the bot
- Command pattern architecture for maintainable code
- Redis-based storage for user data, transactions, and support tickets
- In-memory caching for improved performance
- Typescript for improved code quality and maintainability
- Comprehensive testing suite

## Commands

### User Commands
- `/start` - Initialize the bot and begin the onboarding process
- `/connect` - Connect your TON wallet to the bot
- `/disconnect` - Disconnect your wallet from the bot
- `/mywallet` - View your wallet details and balance
- `/tutorial` - Start the interactive tutorial
- `/skip` - Skip the tutorial
- `/info` - Get help and feature recommendations
- `/support` - Contact support team or respond to support requests
- `/pay-now` - Submit a transaction for approval
- `/withdraw` - Access the withdrawal interface

### Admin Commands
- `/errors [limit]` - View recent error reports (limit defaults to 10)
- `/analytics` - View bot usage statistics
- `/pending` - List pending payment requests
- `/approve <id>` - Approve a payment request
- `/reject <id>` - Reject a payment request

## How to Run the Bot

1. Make sure you have Node.js 18+ and npm installed

2. Configure the `.env` file with your settings:
   - `TELEGRAM_BOT_TOKEN` - Your Telegram bot token from BotFather
   - `MANIFEST_URL` - URL to your TonConnect manifest
   - `ADMIN_IDS` - Comma-separated list of Telegram user IDs with admin access
   - `REDIS_URL` - URL for connecting to your Redis instance
   - `WITHDRAW_URL` - URL for the withdrawal interface

3. Install dependencies:
```bash
npm install
```

4. Compile and run:
```bash
npm run compile && npm run start:redis && npm run run
```

5. For production deployment:
```bash
npm run compile && npm run start:daemon
```

## Testing

Run the test suite to verify functionality:
```bash
npm test
```

For test coverage report:
```bash
npm run test:coverage
```

## Architecture

The bot implements a command pattern architecture that separates command logic into individual classes. Key components include:

- **Command Registry**: Central management of all commands
- **Base Command Classes**: Hierarchy of specialized command types
- **Error Handler**: Global error boundary with logging and reporting
- **Tutorial Manager**: Handles the interactive onboarding process
- **Wallet Cache**: Performance optimization for wallet data
- **Redis Storage**: Persistent storage of user data and state

## Deployment

### Using PM2 Process Manager

1. Start the bot in daemon mode:
```
npm run start:daemon
```

2. Stop the bot:
```
npm run stop:daemon
```

### Troubleshooting PM2

If you encounter issues with PM2, try the following:

1. Install PM2 globally:
```
npm install -g pm2
```

2. Verify installation:
```
pm2 --version
```

3. If you still have issues, try running PowerShell as Administrator.

### Cloud Deployment

If using Render or similar services:
1. Set up Redis storage using the service's Redis add-on
2. Configure environment variables according to the service requirements

## Try It

You can try the example bot at [ton_connect_example_bot](https://t.me/ton_connect_example_bot)
