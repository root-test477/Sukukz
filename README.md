# TonConnect demo telegram bot

## Get started
1. Copy `.env.example` as `.env` and add your bot token there
2. `npm i`
3. `docker run -p 127.0.0.1:6379:6379 -it redis/redis-stack-server:latest`
or
3.b. 
docker run -d -p 127.0.0.1:6379:6379 redis/redis-stack-server:latest
Note the -d flag to run in detached mode, which is better than -it for this use case.

4. `npm run compile`
5. `npm run run`

[See the tutorial](https://docs.ton.org/develop/dapps/ton-connect/tg-bot-integration)

## Run process manager
`npm run start:daemon`

## Stop process manager
`npm run stop:daemon`

More,- Regarding PM2 (daemon mode), if failing try;
# Install PM2 globally
npm install -g pm2

# Verify installation
pm2 --version
then try to run 'npm run start:daemon' again. 
If that doesn't work, you might need to:
Run PowerShell as Administrator

## Try it
[ton_connect_example_bot](https://t.me/ton_connect_example_bot)
