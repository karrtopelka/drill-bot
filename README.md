# Telegram Bot with grammY

A Telegram bot powered by [grammY](https://grammy.dev/) for downloading TikTok videos.

## Features

- TikTok video downloading
- TypeScript support
- Development and production environments

## Local Development

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```
3. Copy `.env-sample` to `.env` and add your variables:
   ```
   BOT_TOKEN=your_bot_token_here
   PORT=3000
   DOMAIN=https://your-domain.com
   SECRET_PATH=your_secret_path
   ```
4. Run the bot in development mode:

   ```bash
   # For polling mode (local testing)
   npm run dev
   # or
   pnpm dev

   # For webhook mode (with ngrok or similar)
   npm run server:dev
   # or
   pnpm server:dev
   ```

## Deployment to VPS

1. SSH into your VPS

2. Clone the repository:

   ```bash
   git clone https://github.com/your-username/your-repo.git
   cd your-repo
   ```

3. Install dependencies:

   ```bash
   npm install
   # or
   pnpm install
   ```

4. Create a `.env` file with your environment variables:

   ```
   BOT_TOKEN=your_bot_token_here
   PORT=3000
   DOMAIN=https://your-domain.com
   SECRET_PATH=your_secret_path
   ```

5. Build the project:

   ```bash
   npm run build
   # or
   pnpm build
   ```

6. Start the bot (using PM2 for persistence):
   ```bash
   npm install -g pm2
   pm2 start npm --name "telegram-bot" -- start
   pm2 save
   pm2 startup
   ```

## Project Structure

- `src/bot.ts`: Main bot logic and handlers
- `src/server.ts`: Express server for webhook mode
- `src/download-tiktok.ts`: TikTok download functionality

## License

MIT
